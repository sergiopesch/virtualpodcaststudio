from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
import feedparser
import httpx
import re
from datetime import datetime
import logging
import json
import asyncio
import websockets
import base64
import os
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Podcast Studio API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PaperRequest(BaseModel):
    topics: List[str]

class Paper(BaseModel):
    id: str
    title: str
    authors: str
    abstract: str
    published: str
    arxiv_url: str

class PaperResponse(BaseModel):
    papers: List[Paper]

class ConversationMessage(BaseModel):
    role: str
    content: str
    timestamp: str

class RealtimeSession:
    def __init__(self, websocket: WebSocket):
        self.client_ws = websocket
        self.openai_ws = None
        self.session_config = {
            "modalities": ["text", "audio"],
            "instructions": "You are a podcast host and AI expert discussing research papers. Engage in natural conversation with the user about academic topics.",
            "voice": "alloy",
            "input_audio_format": "pcm16",
            "output_audio_format": "pcm16",
            "input_audio_transcription": {"enabled": True, "model": "whisper-1"},
            "turn_detection": {"type": "server_vad", "threshold": 0.5, "prefix_padding_ms": 300, "silence_duration_ms": 200},
            "temperature": 0.8,
            "max_output_tokens": 4096
        }
        
    async def connect_to_openai(self):
        """Establish WebSocket connection to OpenAI Realtime API"""
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="OpenAI API key not configured")
            
        headers = {
            "Authorization": f"Bearer {api_key}",
            "OpenAI-Beta": "realtime=v1"
        }
        
        try:
            self.openai_ws = await websockets.connect(
                "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01",
                extra_headers=headers
            )
            logger.info("Connected to OpenAI Realtime API")
            
            # Send session configuration
            await self._send_session_update()
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to OpenAI: {e}")
            return False
    
    async def _send_session_update(self):
        """Send session configuration to OpenAI"""
        session_update = {
            "event_id": f"event_{datetime.now().isoformat()}",
            "type": "session.update",
            "session": self.session_config
        }
        await self.openai_ws.send(json.dumps(session_update))
        
    async def handle_client_message(self, message: Dict[str, Any]):
        """Handle incoming message from client"""
        try:
            if message.get("type") == "audio":
                # Create conversation item with audio input
                item_event = {
                    "event_id": f"event_{datetime.now().isoformat()}",
                    "type": "conversation.item.create",
                    "item": {
                        "id": f"item_{datetime.now().isoformat()}",
                        "type": "message",
                        "role": "user",
                        "content": [{"type": "input_audio", "audio": message["audio"]}]
                    }
                }
                await self.openai_ws.send(json.dumps(item_event))
                
                # Trigger response
                response_event = {
                    "event_id": f"event_{datetime.now().isoformat()}",
                    "type": "response.create"
                }
                await self.openai_ws.send(json.dumps(response_event))
                
            elif message.get("type") == "text":
                # Create conversation item with text input
                item_event = {
                    "event_id": f"event_{datetime.now().isoformat()}",
                    "type": "conversation.item.create",
                    "item": {
                        "id": f"item_{datetime.now().isoformat()}",
                        "type": "message",
                        "role": "user",
                        "content": [{"type": "input_text", "text": message["text"]}]
                    }
                }
                await self.openai_ws.send(json.dumps(item_event))
                
                # Trigger response
                response_event = {
                    "event_id": f"event_{datetime.now().isoformat()}",
                    "type": "response.create"
                }
                await self.openai_ws.send(json.dumps(response_event))
                
        except Exception as e:
            logger.error(f"Error handling client message: {e}")
    
    async def handle_openai_response(self):
        """Handle responses from OpenAI and forward to client"""
        try:
            async for message in self.openai_ws:
                data = json.loads(message)
                event_type = data.get("type")
                
                if event_type == "session.created":
                    await self.client_ws.send_json({"type": "session_ready"})
                    
                elif event_type == "response.audio.delta":
                    # Forward audio delta to client
                    await self.client_ws.send_json({
                        "type": "audio_delta",
                        "audio": data.get("delta", "")
                    })
                    
                elif event_type == "response.text.delta":
                    # Forward text delta to client
                    await self.client_ws.send_json({
                        "type": "text_delta",
                        "text": data.get("delta", "")
                    })
                    
                elif event_type == "response.done":
                    await self.client_ws.send_json({"type": "response_done"})
                    
                elif event_type == "input_audio_buffer.speech_started":
                    await self.client_ws.send_json({"type": "speech_started"})
                    
                elif event_type == "input_audio_buffer.speech_stopped":
                    await self.client_ws.send_json({"type": "speech_stopped"})
                    
        except websockets.exceptions.ConnectionClosed:
            logger.info("OpenAI WebSocket connection closed")
        except Exception as e:
            logger.error(f"Error handling OpenAI response: {e}")
    
    async def close(self):
        """Close OpenAI WebSocket connection"""
        if self.openai_ws:
            await self.openai_ws.close()

def sanitize_input(topic: str) -> str:
    """Sanitize topic input to prevent injection attacks"""
    # Only allow alphanumeric, dots, hyphens, and underscores
    return re.sub(r'[^a-zA-Z0-9.\-_]', '', topic)

def format_authors(authors: str) -> str:
    """Format authors string for display"""
    # Split by comma and take first 3 authors, add "et al." if more
    author_list = [author.strip() for author in authors.split(',')]
    if len(author_list) > 3:
        return f"{', '.join(author_list[:3])}, et al."
    return ', '.join(author_list)

async def fetch_arxiv_papers(topics: List[str], max_results: int = 10) -> List[Paper]:
    """Fetch papers from arXiv API for given topics"""
    papers = []
    
    try:
        for topic in topics:
            sanitized_topic = sanitize_input(topic)
            if not sanitized_topic:
                continue
                
            # Build arXiv API query
            query = f"cat:{sanitized_topic}"
            url = f"https://export.arxiv.org/api/query?search_query={query}&start=0&max_results={max_results}&sortBy=submittedDate&sortOrder=descending"
            
            logger.info(f"Fetching papers from arXiv for topic: {sanitized_topic}")
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, timeout=30.0)
                response.raise_for_status()
                
                # Parse the Atom feed
                feed = feedparser.parse(response.text)
                
                for entry in feed.entries[:max_results]:
                    try:
                        # Extract paper information
                        paper_id = entry.id.split('/abs/')[-1]
                        title = entry.title.strip()
                        
                        # Format authors
                        authors = ", ".join([author.name for author in entry.authors])
                        formatted_authors = format_authors(authors)
                        
                        # Clean abstract
                        abstract = re.sub(r'\s+', ' ', entry.summary.strip())
                        
                        # Parse published date
                        published_date = entry.published
                        
                        # Create arXiv URL
                        arxiv_url = f"https://arxiv.org/abs/{paper_id}"
                        
                        paper = Paper(
                            id=paper_id,
                            title=title,
                            authors=formatted_authors,
                            abstract=abstract,
                            published=published_date,
                            arxiv_url=arxiv_url
                        )
                        
                        papers.append(paper)
                        
                    except Exception as e:
                        logger.error(f"Error processing paper entry: {e}")
                        continue
                        
    except httpx.HTTPError as e:
        logger.error(f"HTTP error fetching from arXiv: {e}")
        raise HTTPException(status_code=503, detail="arXiv API is temporarily unavailable")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    
    # Remove duplicates based on paper ID
    unique_papers = {}
    for paper in papers:
        if paper.id not in unique_papers:
            unique_papers[paper.id] = paper
    
    # Convert back to list, sort by publication date (most recent first) and limit results
    papers = list(unique_papers.values())
    papers.sort(key=lambda x: x.published, reverse=True)
    return papers[:max_results]

@app.get("/")
async def root():
    return {"message": "Podcast Studio API is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

@app.websocket("/ws/conversation")
async def websocket_conversation(websocket: WebSocket):
    """WebSocket endpoint for realtime conversation"""
    await websocket.accept()
    session = RealtimeSession(websocket)
    
    try:
        # Connect to OpenAI Realtime API
        if not await session.connect_to_openai():
            await websocket.send_json({"type": "error", "message": "Failed to connect to OpenAI"})
            return
        
        # Start handling OpenAI responses
        openai_task = asyncio.create_task(session.handle_openai_response())
        
        # Handle client messages
        try:
            while True:
                data = await websocket.receive_json()
                await session.handle_client_message(data)
                
        except WebSocketDisconnect:
            logger.info("Client disconnected")
            openai_task.cancel()
        except Exception as e:
            logger.error(f"Error in WebSocket conversation: {e}")
            await websocket.send_json({"type": "error", "message": str(e)})
        
    finally:
        await session.close()

@app.post("/api/papers", response_model=PaperResponse)
async def fetch_papers(request: PaperRequest):
    """Fetch papers from arXiv based on selected topics"""
    if not request.topics:
        raise HTTPException(status_code=400, detail="At least one topic must be selected")
    
    if len(request.topics) > 10:
        raise HTTPException(status_code=400, detail="Too many topics selected (max 10)")
    
    # Validate topic format
    valid_topics = []
    for topic in request.topics:
        sanitized = sanitize_input(topic)
        if sanitized and len(sanitized) <= 50:  # Reasonable length limit
            valid_topics.append(sanitized)
    
    if not valid_topics:
        raise HTTPException(status_code=400, detail="No valid topics provided")
    
    try:
        papers = await fetch_arxiv_papers(valid_topics)
        return PaperResponse(papers=papers)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in fetch_papers endpoint: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch papers")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
