from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import feedparser
import httpx
import re
from datetime import datetime
import logging

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