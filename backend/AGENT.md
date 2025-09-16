# Backend Agent Guide

## Overview
The backend is a single FastAPI application defined in [`main.py`](./main.py). It exposes
REST and WebSocket endpoints that either proxy to arXiv for research papers or bridge a
browser client to OpenAI's Realtime API. Everything runs inside one module, so edits in
this file affect the entire service.

```
backend/
├── main.py            # FastAPI app, models, realtime bridge, rate limiter
├── requirements.txt   # Python dependencies (FastAPI, httpx, websockets, etc.)
└── AGENT.md           # This guide
```

## Runtime Building Blocks
- **FastAPI app** – created at module import, configured with CORS middleware using the
  `ALLOWED_ORIGINS` environment variable.
- **Rate limiting** – `check_rate_limit` keeps a per-IP sliding window (100 requests in
  60 seconds) shared by both HTTP and WebSocket handlers. Respect it when adding new
  entry points.
- **Pydantic models** – `PaperRequest`, `Paper`, and `PaperResponse` define the schema
  shared with the frontend.
- **RealtimeSession** – lightweight bridge that connects the client WebSocket to
  `wss://api.openai.com/v1/realtime`, relays audio/text events, and pushes typing/speech
  markers back to the browser.

## Endpoints & Flow
| Path | Handler | Notes |
| --- | --- | --- |
| `GET /` | `root` | Simple health banner. |
| `GET /health` | `health_check` | Returns `{status, timestamp}` for readiness probes. |
| `POST /api/papers` | `fetch_papers` | Validates topic payload, rate-limits by IP, calls `fetch_arxiv_papers`, de-duplicates, sorts, and returns up to 10 results. |
| `WS /ws/conversation` | `websocket_conversation` | Accepts JSON messages with `{type: 'audio'|'text'}` and proxies them to OpenAI. Emits deltas for audio/text plus speech boundary events. |

### Paper fetching workflow
1. Input is validated twice: Pydantic (`PaperRequest.topics`) and `sanitize_input` to
   strip invalid characters and enforce a 50-character limit.
2. For each topic we build an Atom query and fetch with `httpx.AsyncClient`. This is done
   sequentially inside an `async` loop; if you add concurrency, reuse a single client and
   keep timeouts at 30s or lower.
3. `feedparser` turns the Atom feed into entries. We canonicalize authors, trim abstracts,
   and track the most recent publication dates.
4. Duplicate IDs are removed before sorting by `published` descending. The result list is
   truncated to `max_results` (defaults to 10) so the frontend never receives more than it
   expects.
5. Errors raise HTTP 503 for upstream failures or 500 for unknown issues. Keep error text
   generic—frontend surfaces the message to end users.

### Realtime workflow
1. Each WebSocket client gets its own `RealtimeSession`. The OpenAI API key is read from
   `OPENAI_API_KEY`; abort early if it is missing.
2. On connect we immediately send a `session.update` event that sets modalities,
   transcription, voice, and server-side VAD config. Update this payload carefully—browser
   code assumes both text and audio are enabled.
3. Incoming client messages:
   - `{type: 'audio', audio: <base64 PCM16>}` → `conversation.item.create` with
     `input_audio` content followed by `response.create`.
   - `{type: 'text', text: string}` → same flow with `input_text`.
4. Downstream messages from OpenAI are streamed back to the browser as JSON events:
   `session_ready`, `audio_delta`, `text_delta`, `response_done`, `speech_started`, and
   `speech_stopped`. When extending, coordinate any new event names with the frontend
   WebSocket client (`useRealtimeConversation`).
5. `websocket_conversation` keeps an asyncio task (`handle_openai_response`) alive while
   relaying user events. Always cancel it on disconnect to avoid leaked coroutines.

## Environment & Secrets
Create `backend/.env` with at least:
- `OPENAI_API_KEY` – required for realtime bridging.
- `ALLOWED_ORIGINS` – optional CSV list to widen CORS beyond `http://localhost:3000`.
- `OPENAI_REALTIME_MODEL`/`VOICE` – optional overrides for realtime sessions.

Never commit `.env` files. `requirements.txt` lists additional security deps (slowapi,
python-jose, passlib) that are not wired in yet—add usage deliberately.

## Implementation Guidelines
- Keep HTTP and WebSocket handlers **async**. Avoid blocking calls inside handlers; use
  `asyncio` primitives when scheduling new tasks.
- Mirror validation logic with the frontend (`/api/papers` route and `transformPapers`).
  Schema changes must be updated in both services before deployment.
- When modifying realtime flows, verify both the FastAPI WebSocket and the Next.js
  WebRTC/SSE paths. The frontend still uses this legacy WS for fallback mode.
- Maintain structured logging (`logger.info/error`). Do not log API keys or full OpenAI
  responses.
- If you add in-memory caches, make them IP-aware so they respect the rate limiter.

## Testing Checklist
- `uvicorn main:app --reload --host 0.0.0.0 --port 8000`
- `curl http://localhost:8000/health`
- `curl -X POST http://localhost:8000/api/papers -H 'Content-Type: application/json' -d '{"topics":["cs.AI"]}'`
- Exercise `/ws/conversation` using the frontend fallback (`useRealtimeConversation`) or a
  custom WebSocket client. Confirm audio/text events round-trip and rate limiting enforces
  429/1008 responses under load.
