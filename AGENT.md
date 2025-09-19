# Virtual Podcast Studio – Agent Handbook

## Overview
This repository delivers an end-to-end "virtual podcast studio" experience composed of two
services that collaborate closely:

- **FastAPI backend (`backend/`)** – validates research topics, fetches arXiv results and
  exposes a WebSocket bridge to OpenAI's realtime API.
- **Next.js 15 frontend (`podcast-studio/`)** – renders the multi-stage production interface,
  manages realtime sessions through server-side API routes, and hands conversations off to
  post-production tooling.

Supporting utilities include a health-check CLI (`quick_health_check.py`) and shared
configuration documentation (`README.md`).

## Repository Layout

| Path | Purpose |
| --- | --- |
| `backend/` | Single-module FastAPI app (`main.py`) serving `/health`, `/api/papers`, and `/ws/conversation`. |
| `podcast-studio/` | Next.js App Router project covering the Research Hub, Audio Studio, Video Studio, Library, Publisher, Analytics pages, and all realtime API routes. |
| `quick_health_check.py` | Lightweight script that verifies `backend/.env` contains `OPENAI_API_KEY` and confirms the `/health` endpoint responds. |
| `README.md` | Setup guide, architecture overview, and troubleshooting notes. |

## End-to-End Flow

1. **Research discovery** – The Research Hub (`src/app/page.tsx`) submits topics to
   `POST /api/papers`. The Next.js API route validates the payload and proxies the request to
   the FastAPI backend, which sanitises topics, calls arXiv, de-duplicates entries, and returns
   the newest papers first.
2. **Realtime conversation** – The Audio Studio (`src/app/studio/page.tsx`) requests a session
   via `POST /api/rt/start`, negotiates WebRTC through `/api/rt/webrtc`, and streams
   microphone audio with `/api/rt/audio-append` + `/api/rt/audio-commit`. Assistant audio and
   transcripts are consumed through the Server-Sent Events routes (`/api/rt/audio`,
   `/api/rt/transcripts`, `/api/rt/user-transcripts`). A legacy fallback WebSocket is still
   available at `backend/ws/conversation` for non-WebRTC clients.
3. **Post-production handoff** – Finished sessions are serialised with
   `src/lib/conversationStorage.ts`, stored in `sessionStorage`, and consumed by the Video
   Studio, Library, and Publisher dashboards to simulate editing/export workflows.

## Service Highlights

### FastAPI backend
- **Rate limiting** – A sliding window cap (100 requests/minute per client IP) protects both
  HTTP and WebSocket endpoints.
- **Paper ingestion** – `fetch_arxiv_papers` sanitises each topic, queries arXiv sequentially
  via `httpx.AsyncClient`, normalises authors/abstracts, and sorts by `published` date before
  truncating to the configured max results.
- **Realtime bridge** – `RealtimeSession` opens a WebSocket to OpenAI using the configured
  realtime model/voice, forwards audio or text input events, and relays audio/text deltas plus
  speech boundary notifications back to the browser client.

### Next.js frontend
- **Layout & context** – `src/app/layout.tsx` wraps pages in `SidebarProvider` and
  `ApiConfigProvider`, enabling layout collapse state and provider/API-key selection across the
  entire app.
- **Pages** – Research Hub (topic selection + paper discovery), Audio Studio (session
  orchestration, live transcript, export tools), Video Studio (timeline editor consuming stored
  sessions), Library/Publisher/Analytics (dashboard-style mocks).
- **API routes** – `/api/papers` proxies to FastAPI, while `/api/rt/*` endpoints manage realtime
  sessions via the shared `rtSessionManager` singleton in `src/lib/realtimeSession.ts`.
- **Shared libraries** – `realtimeSession.ts` maintains OpenAI connections and emits SSE
  events; `conversationStorage.ts` encodes/decodes PCM16 audio and persists conversations for
  the video tooling; `src/components/ui` hosts shadcn-inspired primitives.

## Environment & Secrets

| Area | Variables |
| --- | --- |
| Backend (`backend/.env`) | `OPENAI_API_KEY` (required), optional `ALLOWED_ORIGINS`, `OPENAI_REALTIME_MODEL`, `OPENAI_REALTIME_VOICE`. |
| Frontend (`podcast-studio/.env.local`) | `OPENAI_API_KEY` (server-side fallback for realtime routes), optional `OPENAI_REALTIME_MODEL`, `OPENAI_REALTIME_VOICE`, `BACKEND_URL`, `NEXT_PUBLIC_BACKEND_URL`. |

Never commit `.env*` files. Frontend API routes will fall back to the server-side key only
when the user has not supplied one via the workspace settings sheet.

## Development Workflow

1. **Install dependencies**
   - Backend: `cd backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt`.
   - Frontend: `cd podcast-studio && npm install`.
2. **Run services**
   - Backend: `uvicorn main:app --host 0.0.0.0 --port 8000 --reload`.
   - Frontend: `npm run dev` (Turbopack) and visit `http://localhost:3000/studio`.
3. **Verify configuration**
   - Execute `python quick_health_check.py` to confirm the backend is reachable and the API
     key is present.
   - Hit `GET /api/test-openai` from the frontend to ensure the OpenAI credential can list
     models.
4. **Quality gates**
   - Frontend lint: `npm run lint` (ESLint 9).
   - Frontend build: `npm run build` before shipping substantial UI/API changes.
   - Backend: exercise `/health`, `/api/papers`, and `/ws/conversation` (or the WebRTC flow)
     using the running frontend.

## Coordination Guardrails

- **Shared schemas** – Any change to the paper payload must be applied in tandem across
  `backend/main.py`, `src/app/api/papers/route.ts`, the Research Hub's `transformPapers`, and
  the Audio Studio's stored paper shape.
- **Session storage contract** – `vps:selectedPaper` and the conversation archive stored by
  `conversationStorage.ts` are read by multiple pages. Keep them backwards compatible when
  adding fields.
- **Realtime events** – When emitting new events from `realtimeSession.ts`, update the
  corresponding API routes and Audio Studio consumers (data channel handlers + SSE listeners)
  so everything stays in sync.
- **Logging** – Both services log to stdout. Preserve the existing patterns and avoid printing
  raw audio buffers or secrets.
- **Documentation** – Update this handbook, nested `AGENT.md` files, and the README whenever
  you introduce new workflows, environment variables, or developer steps.
