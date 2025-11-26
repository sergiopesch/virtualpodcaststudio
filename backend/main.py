from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator
from typing import List
import feedparser
import httpx
import re
from datetime import datetime
import logging
import os
from dotenv import load_dotenv
from collections import defaultdict
import time

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Podcast Studio API", version="1.0.0")

# Simple rate limiting
rate_limit_store = defaultdict(list)
RATE_LIMIT_REQUESTS = 100  # requests per minute
RATE_LIMIT_WINDOW = 60  # seconds

def check_rate_limit(client_ip: str) -> bool:
    """Simple rate limiting check"""
    now = time.time()
    
    # Clean old requests
    rate_limit_store[client_ip] = [
        timestamp for timestamp in rate_limit_store[client_ip]
        if now - timestamp < RATE_LIMIT_WINDOW
    ]
    
    # Check if under limit
    if len(rate_limit_store[client_ip]) >= RATE_LIMIT_REQUESTS:
        return False
    
    # Add current request
    rate_limit_store[client_ip].append(now)
    return True

# Add CORS middleware
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

class PaperRequest(BaseModel):
    topics: List[str]
    
    @validator('topics')
    def validate_topics(cls, v):
        if not v or len(v) == 0:
            raise ValueError('At least one topic is required')
        if len(v) > 10:
            raise ValueError('Maximum 10 topics allowed')
        
        valid_topics = []
        for topic in v:
            if not isinstance(topic, str):
                raise ValueError('All topics must be strings')
            if len(topic) > 50:
                raise ValueError('Topic length cannot exceed 50 characters')
            if not re.match(r'^[a-zA-Z0-9.\-_]+$', topic):
                raise ValueError('Topic contains invalid characters')
            valid_topics.append(topic)
        
        return valid_topics

class Paper(BaseModel):
    id: str
    title: str
    authors: str
    abstract: str
    published: str
    arxiv_url: str

class PaperResponse(BaseModel):
    papers: List[Paper]

def sanitize_input(topic: str) -> str:
    """Sanitize topic input to prevent injection attacks"""
    if not isinstance(topic, str):
        return ""
    
    # Remove any whitespace and limit length
    topic = topic.strip()[:50]
    
    # Only allow alphanumeric, dots, hyphens, and underscores
    sanitized = re.sub(r'[^a-zA-Z0-9.\-_]', '', topic)
    
    # Additional validation - must start with alphanumeric
    if not sanitized or not sanitized[0].isalnum():
        return ""
    
    return sanitized

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
    
    if not topics:
        logger.warning("No topics provided for arXiv query")
        return papers
    
    try:
        for topic in topics:
            sanitized_topic = sanitize_input(topic)
            if not sanitized_topic:
                logger.warning(f"Skipping invalid topic: {topic}")
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

@app.post("/api/papers", response_model=PaperResponse)
async def fetch_papers(request: PaperRequest, http_request: Request):
    """Fetch papers from arXiv based on selected topics"""
    # Rate limiting
    client_ip = http_request.client.host if http_request.client else "unknown"
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Please try again later.")
    
    try:
        papers = await fetch_arxiv_papers(request.topics)
        return PaperResponse(papers=papers)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in fetch_papers endpoint: {e}")
        raise HTTPException(status_code=500, detail="Service temporarily unavailable")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
