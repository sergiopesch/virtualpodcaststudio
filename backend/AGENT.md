# Backend Agent Guide

## Structure
Everything lives in [`main.py`](./main.py). The module defines the FastAPI application,
rate-limiter, and arXiv client utilities. There are no additional packages—changes to this
file impact the entire backend.

```
backend/
├── main.py            # FastAPI app, models, rate limiter, arXiv client
├── requirements.txt   # Dependency pins (FastAPI, httpx, feedparser, etc.)
└── AGENT.md           # This guide
```

## Purpose
The backend serves as a lightweight API for fetching research papers from arXiv. Realtime
conversations are handled entirely by the Next.js frontend (`/api/rt/*` routes), so this
backend is only needed for the papers discovery feature.

## Core Components
- **FastAPI app** – Created at import time, configured with CORS based on the
  `ALLOWED_ORIGINS` environment variable (defaults to `http://localhost:3000`).
- **Rate limiting** – `check_rate_limit` stores timestamps per client IP (100 requests in a
  60 second window). It guards all HTTP routes.
- **Data models** – `PaperRequest`, `Paper`, and `PaperResponse` describe the payload shared
  with the frontend. Validation mirrors the Next.js proxy route and enforces length/character
  constraints.
- **Input helpers** – `sanitize_input` trims and whitelists topic strings; `format_authors`
  condenses the author list (first three + "et al.") for card display.
- **ArXiv ingestion** – `fetch_arxiv_papers` loops through topics, builds Atom queries,
  fetches results with `httpx.AsyncClient`, normalises metadata, then de-duplicates and sorts
  by the `published` timestamp before truncating to the requested maximum.

## Endpoints
| Path | Handler | Notes |
| --- | --- | --- |
| `GET /` | `root` | Simple JSON banner indicating the API is running. |
| `GET /health` | `health_check` | Returns `{status, timestamp}` for readiness checks. |
| `POST /api/papers` | `fetch_papers` | Validates topics, applies rate limiting, calls `fetch_arxiv_papers`, and returns the deduped, sorted list. |

## Implementation Notes
- Keep handlers **async**; avoid blocking operations inside routes.
- Mirror validation logic with the frontend proxy. Schema changes must be coordinated with
  `src/app/api/papers/route.ts`, the Research Hub, and the Audio Studio's stored paper shape.
- Logging uses the module-level `logger`. Keep messages informative without exposing secrets or
  dumping large payloads.

## Environment
Create `backend/.env` with:
- `OPENAI_API_KEY` – Optional (not used by current endpoints, but may be needed for future features).
- `ALLOWED_ORIGINS` – Optional CSV to widen CORS (default: `http://localhost:3000,http://localhost:3001`).

## Testing Checklist
1. Start the server: `uvicorn main:app --host 0.0.0.0 --port 8000 --reload`.
2. `curl http://localhost:8000/health` to confirm health.
3. `curl -X POST http://localhost:8000/api/papers -H 'Content-Type: application/json' -d '{"topics":["cs.AI"]}'` to verify
   arXiv integration.
4. Verify the rate limiter returns 429 when the per-minute quota is exceeded.

## Note on Realtime Conversations
Realtime AI conversations are **not handled by this backend**. They are managed entirely by the
Next.js frontend through the `/api/rt/*` routes, which maintain a server-side WebSocket connection
to OpenAI's Realtime API and stream events to the browser via SSE.
