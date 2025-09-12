# Backend Agent Guide

## 🎯 Purpose

FastAPI backend that powers the Virtual Podcast Studio's research phase by fetching research papers from arXiv API. This backend serves as the foundation for the podcast production pipeline, providing curated research content that feeds into the Audio Studio, Video Studio, and Publisher phases.

## 📁 File Structure

```text
backend/
├── main.py              # Main FastAPI application
├── requirements.txt      # Python dependencies
├── venv/               # Virtual environment (don't modify)
└── AGENT.md            # This file
```

## 🚀 Key Functions

### `main.py`

- **`/health`**: Health check endpoint
- **`/api/papers`**: Main endpoint for fetching papers
- **`fetch_papers_from_arxiv()`**: Core function that queries arXiv API
- **`parse_arxiv_response()`**: Parses XML response from arXiv

## 🔧 API Endpoints

### `GET /health`

- **Purpose**: Health check
- **Response**: `{"status": "healthy"}`
- **Usage**: Test if backend is running

### `POST /api/papers`

- **Purpose**: Fetch papers from arXiv
- **Request Body**: `{"topics": ["cs.AI", "cs.LG"]}`
- **Response**: `{"papers": [{"id": "...", "title": "...", "authors": "...", "abstract": "...", "published": "...", "arxiv_url": "..."}]}`
- **Max Results**: 10 papers per topic (configurable)

## 🔄 Data Processing

### arXiv API Integration

- **URL**: `https://export.arxiv.org/api/query`
- **Query Format**: `cat:cs.AI&start=0&max_results=10&sortBy=submittedDate&sortOrder=descending`
- **Response**: XML format
- **Parsing**: Extracts id, title, authors, abstract, published date, arxiv_url

### Deduplication Logic

```python
# Remove duplicates based on paper ID
unique_papers = {}
for paper in papers:
    if paper.id not in unique_papers:
        unique_papers[paper.id] = paper
```

### Sorting

- Papers are sorted by publication date (most recent first)
- Limited to max_results per request

## 🛠️ Development Notes

### Error Handling

- **HTTP Errors**: Catches and logs arXiv API errors
- **Validation**: Validates topic list is not empty
- **Logging**: Uses Python logging for debugging

### Dependencies

- **fastapi**: Web framework
- **httpx**: HTTP client for arXiv API
- **uvicorn**: ASGI server
- **python-dotenv**: Environment variables

### Environment

- **Virtual Environment**: Always activate with `source venv/bin/activate`
- **Port**: Runs on 8000 by default
- **Reload**: Auto-reloads on file changes with `--reload`

## 🐛 Common Issues

### arXiv API

- **HTTPS Required**: Always use `https://export.arxiv.org` (not http)
- **Rate Limiting**: arXiv has rate limits, be respectful
- **XML Parsing**: Response is XML, not JSON

### Performance

- **Concurrent Requests**: Multiple topics are fetched concurrently
- **Timeout**: httpx has default timeout settings
- **Memory**: Papers are stored in memory, not persisted

## 🔍 Testing

```bash
# Health check
curl http://localhost:8000/health

# Fetch papers
curl -X POST http://localhost:8000/api/papers \
  -H "Content-Type: application/json" \
  -d '{"topics": ["cs.AI"]}'
```

## 📝 When Modifying

### Adding New Topics

1. Update topic validation in `main.py`
2. Test with arXiv API to ensure category exists
3. Update frontend topic list

### Changing API Response

1. Modify `Paper` model
2. Update `parse_arxiv_response()` function
3. Update frontend to handle new fields

### Performance Optimization

1. Add caching for arXiv responses
2. Implement pagination
3. Add request rate limiting

## 🎯 Agent Instructions

- Always test API endpoints after changes
- Check arXiv API documentation for new features
- Maintain backward compatibility with frontend
- Use proper error handling and logging
- Follow FastAPI best practices for async/await
