# `/api/papers` Routes – Agent Guide

## Overview
The papers API routes handle research paper operations:

```
src/app/api/papers/
├── route.ts           # Proxy to FastAPI backend for paper search
├── fetch-text/route.ts # PDF text extraction from arXiv
└── AGENT.md           # This guide
```

## `/api/papers` (route.ts)

### Responsibility
`src/app/api/papers/route.ts` is a Node runtime handler that proxies Research Hub requests to the
FastAPI backend. It mirrors backend validation, forwards the payload, and normalises error
responses so the UI can display clear messaging.

### Request Lifecycle
1. Parse the JSON body from `NextRequest` and ensure `topics` exists, is an array with 1–10 string
   entries, each ≤50 characters and matching `^[a-zA-Z0-9.\-_]+$`.
2. Forward the payload to `${BACKEND_URL}/api/papers` (defaults to
   `http://localhost:8000/api/papers`). No caching headers are set here because the client request
   already uses `cache: "no-store"`.
3. On non-200 responses, attempt to parse `{detail}` from the backend JSON and rethrow it as
   `{ error }` with the original status so the Research Hub can surface validation or rate-limit
   messages.
4. Catch connection failures (e.g., `ECONNREFUSED`) and return HTTP 503 instructing developers to
   start the FastAPI server.
5. Respond to preflight requests via the exported `OPTIONS` handler, honouring `FRONTEND_URL`
   (defaults to `http://localhost:3000`).

### Implementation Notes
- The route implicitly runs on the Node.js runtime—avoid importing client modules or using
  edge-only APIs. If you introduce Node-specific APIs, you can add `export const runtime = "nodejs";`
  explicitly.
- Keep validation in sync with `backend/main.py::PaperRequest` and `sanitize_input`. Update both
  sides when new constraints or fields are introduced.
- Avoid storing module-level state. App Router may reuse the module across requests, so rely on
  per-request variables.

## `/api/papers/fetch-text` (fetch-text/route.ts)

### Responsibility
Fetches and extracts text content from arXiv PDF papers. This provides rich context to the AI
before starting a realtime conversation session.

### Request Format
```typescript
POST /api/papers/fetch-text
Content-Type: application/json

{
  "arxivUrl": "https://arxiv.org/abs/2401.12345"
}
```

### Response Format
```typescript
// Success
{ "text": "Full paper text content..." }

// Graceful failure (still 200 OK)
{ "text": null, "error": "Description of what went wrong" }
```

### Request Lifecycle
1. Parse `arxivUrl` from request body
2. Convert abstract URL to PDF URL (e.g., `/abs/` → `/pdf/`)
3. Fetch PDF from arXiv with browser-like User-Agent to avoid 403 errors
4. Validate response is actually a PDF (check for `%PDF` signature)
5. Parse PDF using `pdf-parse` library to extract text
6. Return extracted text or graceful error

### Key Features
- **Graceful Degradation**: Always returns 200 OK, with `text: null` on failure
- **PDF Validation**: Checks for PDF signature before parsing to avoid crashes
- **Browser User-Agent**: Mimics standard browser to bypass arXiv restrictions
- **60-second timeout**: Extended timeout for large PDFs via `maxDuration`

### Implementation Notes
- Uses `pdf-parse` v2.x class-based API: `new PDFParse({ data: buffer }).getText()`
- The Audio Studio pre-fetches paper text on paper selection, not on session start
- If text extraction fails, the session can still proceed with just the abstract
- arXiv may occasionally return HTML error pages instead of PDFs; the signature check catches this

## Testing

### Papers Search
- With the backend running: `curl -X POST http://localhost:3000/api/papers -H 'Content-Type: application/json' -d '{"topics":["cs.AI"]}'`.
- Simulate validation failures (e.g., too many topics) and verify the Research Hub displays the
  returned error message.
- Stop the backend to confirm the handler responds with HTTP 503 and helpful guidance.

### PDF Text Extraction
```bash
curl -X POST http://localhost:3000/api/papers/fetch-text \
  -H 'Content-Type: application/json' \
  -d '{"arxivUrl": "https://arxiv.org/abs/2401.12345"}'
```
- Verify text is extracted from valid arXiv URLs
- Test with invalid URLs to confirm graceful error response
- Check that the Audio Studio shows "Context Ready" after successful fetch
