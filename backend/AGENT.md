# Backend Agent Guide

## Structure
Everything lives in [`main.py`](./main.py). The module defines the FastAPI application,
rate-limiter, arXiv client utilities, and the realtime WebSocket bridge. There are no
additional packages—changes to this file impact the entire backend.

```
backend/
├── main.py            # FastAPI app, models, realtime bridge, rate limiter
├── requirements.txt   # Dependency pins (FastAPI, httpx, feedparser, websockets, etc.)
└── AGENT.md           # This guide
```

## Core Components
- **FastAPI app** – Created at import time, configured with CORS based on the
  `ALLOWED_ORIGINS` environment variable (defaults to `http://localhost:3000`).
- **Rate limiting** – `check_rate_limit` stores timestamps per client IP (100 requests in a
  60 second window). It guards both HTTP routes and the WebSocket endpoint.
- **Data models** – `PaperRequest`, `Paper`, and `PaperResponse` describe the payload shared
  with the frontend. Validation mirrors the Next.js proxy route and enforces length/character
  constraints.
- **Input helpers** – `sanitize_input` trims and whitelists topic strings; `format_authors`
  condenses the author list (first three + “et al.”) for card display.
- **ArXiv ingestion** – `fetch_arxiv_papers` loops through topics, builds Atom queries,
  fetches results with `httpx.AsyncClient`, normalises metadata, then de-duplicates and sorts
  by the `published` timestamp before truncating to the requested maximum.
- **Realtime bridge** – `RealtimeSession` owns the outbound WebSocket to OpenAI. It sends an
  initial `session.update` payload (`modalities` text+audio, Whisper transcription, server VAD),
  forwards user audio/text inputs as `conversation.item.create` events, triggers
  `response.create`, and relays downstream events (`session_ready`, audio/text deltas, speech
  start/stop) back to the browser WebSocket client.

## Endpoints
| Path | Handler | Notes |
| --- | --- | --- |
| `GET /` | `root` | Simple JSON banner indicating the API is running. |
| `GET /health` | `health_check` | Returns `{status, timestamp}` for readiness checks. |
| `POST /api/papers` | `fetch_papers` | Validates topics, applies rate limiting, calls `fetch_arxiv_papers`, and returns the deduped, sorted list. |
| `WS /ws/conversation` | `websocket_conversation` | Legacy realtime bridge. Ensures rate-limit compliance, connects to OpenAI, relays audio/text events, and tears down the OpenAI socket on disconnect. |

## Implementation Notes
- Keep handlers **async**; avoid blocking operations inside routes or WebSocket loops.
- Mirror validation logic with the frontend proxy. Schema changes must be coordinated with
  `src/app/api/papers/route.ts`, the Research Hub, and the Audio Studio’s stored paper shape.
- `RealtimeSession` stores its configuration on instantiation. If you alter session defaults
  (voice, modalities, transcription), update the Audio Studio so it expects the same
  capabilities.
- Always close the OpenAI socket in `RealtimeSession.close()` (the websocket route calls this
  in a `finally` block). If you add background tasks, cancel them when the client disconnects.
- Logging uses the module-level `logger`. Keep messages informative without exposing secrets or
  dumping large payloads.

## Environment
Create `backend/.env` with:
- `OPENAI_API_KEY` – required for realtime bridging.
- `ALLOWED_ORIGINS` – optional CSV to widen CORS.
- `OPENAI_REALTIME_MODEL` / `OPENAI_REALTIME_VOICE` – optional overrides for session settings.

`requirements.txt` also lists security-related packages (`slowapi`, `python-jose`,
`passlib`) that are not currently in use—only pull them in deliberately.

## Testing Checklist
1. Start the server: `uvicorn main:app --host 0.0.0.0 --port 8000 --reload`.
2. `curl http://localhost:8000/health` to confirm health.
3. `curl -X POST http://localhost:8000/api/papers -H 'Content-Type: application/json' -d '{"topics":["cs.AI"]}'` to verify
   arXiv integration.
4. Exercise `/ws/conversation` using the frontend fallback or a custom WebSocket client. Ensure
   audio/text messages flow and the rate limiter returns 429/1008 when the per-minute quota is
   exceeded.
