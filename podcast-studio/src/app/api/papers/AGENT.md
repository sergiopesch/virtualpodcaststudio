# API Route Agent Guide

## 🎯 Purpose

Next.js API route that acts as a proxy between the frontend and FastAPI backend for fetching research papers.

## 📁 File Location

```text
src/app/api/papers/route.ts
```

## 🔧 Function Overview

### `POST` Handler

- **Purpose**: Proxy requests to FastAPI backend
- **Input**: JSON with topics array
- **Output**: JSON with papers array
- **Error Handling**: Catches and formats backend errors

## 🔄 Request/Response Flow

### Request Format

```typescript
{
  "topics": ["cs.AI", "cs.LG", "cs.CV", "cs.RO"]
}
```

### Response Format

```typescript
{
  "papers": [
    {
      "id": "2509.09679v1",
      "title": "Paper Title",
      "authors": "Author 1, Author 2, et al.",
      "abstract": "Paper abstract...",
      "published": "2025-09-11T17:59:59Z",
      "arxiv_url": "https://arxiv.org/abs/2509.09679v1"
    }
  ]
}
```

## 🛠️ Implementation Details

### Backend Communication

- **URL**: `http://localhost:8000/api/papers`
- **Method**: POST
- **Headers**: Content-Type: application/json
- **Timeout**: Default fetch timeout

### Error Handling

- **Network Errors**: Catches fetch failures
- **Backend Errors**: Forwards backend error messages
- **Validation**: Ensures topics array is provided

### Response Processing

- **Success**: Returns papers array directly
- **Error**: Returns error message with 500 status
- **Timeout**: Handles fetch timeouts gracefully

## 🔍 Testing

### Manual Testing

```bash
# Test API route
curl -X POST http://localhost:3000/api/papers \
  -H "Content-Type: application/json" \
  -d '{"topics": ["cs.AI"]}'
```

### Expected Responses

- **Success**: 200 status with papers array
- **Error**: 500 status with error message
- **Invalid Input**: 500 status with validation error

## 🐛 Common Issues

### Backend Connection

- **Problem**: Backend not running
- **Solution**: Ensure FastAPI server is running on port 8000
- **Check**: `curl http://localhost:8000/health`

### CORS Issues

- **Problem**: Cross-origin request blocked
- **Solution**: Next.js handles CORS automatically
- **Note**: No additional CORS configuration needed

### Timeout Issues

- **Problem**: Request times out
- **Solution**: Check backend performance
- **Debug**: Add timeout handling

## 📝 When Modifying

### Adding New Endpoints

1. Create new route file in `api/` directory
2. Follow Next.js App Router conventions
3. Test with curl or frontend

### Changing Request Format

1. Update TypeScript interfaces
2. Modify request validation
3. Update frontend to match

### Adding Middleware

1. Use Next.js middleware
2. Add authentication/authorization
3. Implement rate limiting

## 🎯 Agent Instructions

- Always test API routes after changes
- Maintain consistent error handling
- Use TypeScript for type safety
- Follow Next.js App Router patterns
- Handle edge cases gracefully
- Document any new endpoints
