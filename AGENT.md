# Virtual Podcast Studio – Agent Handbook

This repository delivers an end-to-end “virtual podcast studio” experience built from two major services:

- **FastAPI backend (`backend/`)** that retrieves research content from arXiv and (optionally) proxies realtime voice sessions to OpenAI.【F:backend/main.py†L1-L205】【F:backend/main.py†L206-L323】
- **Next.js 15 frontend (`podcast-studio/`)** that renders the multi-stage production interface (research hub, audio studio, video studio, library, publisher) and exposes Node-powered API routes for realtime OpenAI conversations.【F:podcast-studio/src/app/page.tsx†L1-L473】【F:podcast-studio/src/app/studio/page.tsx†L1-L209】

Directory-specific agent notes live inside `backend/AGENT.md` and `podcast-studio/AGENT.md`; consult them for deep dives before editing files under those trees.【F:backend/AGENT.md†L1-L109】【F:podcast-studio/AGENT.md†L1-L121】 This root guide explains how the pieces fit together and what to check when making cross-cutting changes.

---

## Repository Tour

| Path | Purpose | Key Artifacts |
| --- | --- | --- |
| `backend/` | FastAPI app serving `/health`, `/api/papers`, and `/ws/conversation` plus rate limiting, arXiv ingestion, and OpenAI Realtime relaying. | `main.py`, `requirements.txt` |
| `podcast-studio/` | Next.js App Router project with UI, client pages, shadcn components, realtime hooks, and API routes for OpenAI sessions. | `src/app/**/*`, `src/lib/realtimeSession.ts`, `src/app/api/**/*` |
| `quick_health_check.py` | CLI helper to verify `.env` secrets and the FastAPI health endpoint. | – |
| `README.md` | Setup, architecture, topic list, troubleshooting. | – |

---

## Data & Control Flow

1. **Research discovery** – Frontend `POST /api/papers` → Next proxy route → FastAPI `/api/papers` → arXiv Atom feed → deduped & sorted list back to UI cards. The Research Hub transforms responses into enriched card metadata while aborting stale requests so the UI never flashes outdated topics.【F:podcast-studio/src/app/api/papers/route.ts†L1-L61】【F:backend/main.py†L206-L323】【F:podcast-studio/src/app/page.tsx†L93-L215】
2. **Realtime conversation (WebRTC path)** – Studio page builds a browser `RTCPeerConnection`, exchanges SDP with `/api/rt/webrtc`, and streams audio/text directly from OpenAI via the Node session manager.【F:podcast-studio/src/app/studio/page.tsx†L400-L533】【F:podcast-studio/src/app/api/rt/webrtc/route.ts†L1-L37】 Audio/text deltas flow through SSE endpoints (`/api/rt/audio`, `/api/rt/transcripts`, `/api/rt/user-transcripts`).【F:podcast-studio/src/app/api/rt/audio/route.ts†L1-L107】【F:podcast-studio/src/app/api/rt/transcripts/route.ts†L1-L104】
3. **Realtime conversation (WebSocket fallback)** – `backend/main.py` still exposes `/ws/conversation` that relays user audio/text to OpenAI Realtime over websockets for legacy or alternative clients.【F:backend/main.py†L101-L205】【F:backend/main.py†L324-L399】
4. **UI rendering** – Shared sidebar/header layout wraps every page via `src/app/layout.tsx` and context providers (`SidebarProvider`). Page components focus on their domain (e.g., research hub grid, audio studio controls, production dashboards).【F:podcast-studio/src/app/layout.tsx†L1-L36】【F:podcast-studio/src/app/page.tsx†L218-L468】

---

## Backend Quick Facts

- **Framework & deps**: FastAPI + httpx + feedparser + websockets; see `requirements.txt` for exact pins.【F:backend/requirements.txt†L1-L12】
- **Endpoints**:
  - `GET /health` → availability ping with timestamp.【F:backend/main.py†L332-L336】
  - `POST /api/papers` → validates up to 10 topics, sanitizes input, queries arXiv concurrently, dedupes, sorts by published date.【F:backend/main.py†L206-L323】
  - `WS /ws/conversation` → rate-limited realtime bridge that streams OpenAI audio/text events back to the browser.【F:backend/main.py†L101-L205】【F:backend/main.py†L338-L399】
- **Rate limiting**: Simple in-memory sliding window per client IP (`RATE_LIMIT_REQUESTS`, `RATE_LIMIT_WINDOW`).【F:backend/main.py†L24-L41】
- **Environment**: `.env` expects `OPENAI_API_KEY`, optional `ALLOWED_ORIGINS`; defaults allow `http://localhost:3000`.【F:backend/main.py†L43-L47】
- **When editing**: Keep request validation and deduplication aligned with the frontend expectations, and preserve async patterns (httpx.AsyncClient, `async def`) to avoid blocking.

---

## Frontend Quick Facts

- **Stack**: Next.js 15 with the App Router, React 19, TypeScript, Tailwind 4, shadcn/ui, lucide-react icons, and Turbopack for dev/build.【F:podcast-studio/package.json†L1-L36】
- **Layout & navigation**: `Sidebar` and `Header` components manage the chrome; `SidebarProvider` exposes collapse state globally.【F:podcast-studio/src/components/layout/sidebar.tsx†L1-L149】【F:podcast-studio/src/components/layout/header.tsx†L1-L83】【F:podcast-studio/src/contexts/sidebar-context.tsx†L1-L36】
- **Pages**:
  - `src/app/page.tsx` – Research Hub: accessible topic toggles backed by a memoized `Set`, abortable fetch workflow, paper transformation helpers, interactive card actions, and a sessionStorage handoff (`vps:selectedPaper`) that powers the Audio Studio's context card.【F:podcast-studio/src/app/page.tsx†L125-L466】
  - `src/app/studio/page.tsx` – Audio Studio: WebRTC connect workflow, PCM16 microphone upload, live transcript/chat rendering, export controls, sessionStorage-driven current paper hydration, and a sidebar that only shows the LIVE badge while `isRecording` is true.【F:podcast-studio/src/app/studio/page.tsx†L1-L318】【F:podcast-studio/src/app/studio/page.tsx†L600-L1013】
  - `src/app/video-studio/page.tsx`, `src/app/library/page.tsx`, `src/app/publisher/page.tsx` – Detailed mock production dashboards with editing controls and analytics to round out the workflow.【F:podcast-studio/src/app/video-studio/page.tsx†L1-L120】【F:podcast-studio/src/app/library/page.tsx†L1-L120】【F:podcast-studio/src/app/publisher/page.tsx†L1-L120】
- **Shared UI**: shadcn components live in `src/components/ui/` (see their AGENT for usage patterns). Utilities like `cn()` are in `src/lib/utils.ts`.【F:podcast-studio/src/components/ui/AGENT.md†L1-L121】【F:podcast-studio/src/lib/utils.ts†L1-L5】

---

## Realtime Session Infrastructure (Next.js)

- **Session manager**: `src/lib/realtimeSession.ts` keeps a hot-reload-safe singleton of `RTSessionManager`. It opens a WebSocket to the OpenAI Realtime API, forwards audio/text deltas, auto-triggers responses, and cleans up idle sessions.【F:podcast-studio/src/lib/realtimeSession.ts†L1-L199】【F:podcast-studio/src/lib/realtimeSession.ts†L200-L475】
- **API routes**: Located in `src/app/api/rt/`.
  - `start`/`status`/`stop` manage lifecycle and expose health info.【F:podcast-studio/src/app/api/rt/start/route.ts†L1-L64】【F:podcast-studio/src/app/api/rt/status/route.ts†L1-L37】【F:podcast-studio/src/app/api/rt/stop/route.ts†L1-L18】
  - `audio-append`, `audio-commit`, `text` push user input to OpenAI via the manager.【F:podcast-studio/src/app/api/rt/audio-append/route.ts†L1-L57】【F:podcast-studio/src/app/api/rt/audio-commit/route.ts†L1-L49】【F:podcast-studio/src/app/api/rt/text/route.ts†L1-L57】
  - `audio`, `transcripts`, `user-transcripts` stream assistant output and live transcriptions back over Server-Sent Events.【F:podcast-studio/src/app/api/rt/audio/route.ts†L1-L107】【F:podcast-studio/src/app/api/rt/transcripts/route.ts†L1-L104】【F:podcast-studio/src/app/api/rt/user-transcripts/route.ts†L1-L103】
  - `webrtc` exchanges SDP offers for low-latency media when browsers prefer WebRTC.【F:podcast-studio/src/app/api/rt/webrtc/route.ts†L1-L37】
- **Hook**: `useRealtimeConversation.ts` provides a legacy WebSocket client that talks to the FastAPI `/ws/conversation`. Keep it in sync if you maintain the fallback path.【F:podcast-studio/src/hooks/useRealtimeConversation.ts†L1-L110】

---

## Environment & Secrets

| Service | Required variables |
| --- | --- |
| Backend (`backend/.env`) | `OPENAI_API_KEY`, optional `ALLOWED_ORIGINS`, `OPENAI_REALTIME_MODEL`, `OPENAI_REALTIME_VOICE`. Defaults target `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01`.【F:backend/main.py†L68-L103】 |
| Frontend (`podcast-studio/.env.local`) | `OPENAI_API_KEY` (for server-side API routes), optional `OPENAI_REALTIME_MODEL`, `OPENAI_REALTIME_VOICE`, `BACKEND_URL`, `NEXT_PUBLIC_BACKEND_URL`. The API routes will fail fast if the key is missing (`test-openai` endpoint helps validate).【F:podcast-studio/src/app/api/rt/webrtc/route.ts†L1-L37】【F:podcast-studio/src/app/api/test-openai/route.ts†L1-L53】 |

Store secrets locally only; never commit `.env*` files.

---

## Development Workflow

1. **Install dependencies**
   - Backend: `cd backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt`.
   - Frontend: `cd podcast-studio && npm install`.
2. **Run services**
   - Backend API: `uvicorn main:app --host 0.0.0.0 --port 8000 --reload` from the virtualenv.【F:README.md†L29-L61】
   - Frontend dev server: `npm run dev` (Turbopack) and visit `http://localhost:3000/studio`.【F:README.md†L63-L87】
3. **Health check**
   - Execute `python quick_health_check.py` to confirm `.env` and backend availability.【F:quick_health_check.py†L1-L66】
   - `GET /api/test-openai` (frontend) reports whether your OpenAI credentials can list models.【F:podcast-studio/src/app/api/test-openai/route.ts†L1-L53】
4. **Quality gates**
   - Frontend lint: `npm run lint` (ESLint 9).【F:podcast-studio/package.json†L1-L36】
   - Frontend build: `npm run build` before shipping major UI/API changes.
   - Backend: run `uvicorn` locally and exercise `/health` + `/api/papers`; add automated tests if you extend business logic.

---

## Agent Best Practices

- **Coordinate schema changes**: If you alter `Paper` fields in the backend, update the Next.js proxy route and UI card rendering simultaneously so `transformPapers` and the card view stay aligned. Remember to update both sides of the sessionStorage bridge (`Home.handleStartAudioStudio` ⇄ `Studio.SelectedPaper`).【F:backend/main.py†L52-L87】【F:podcast-studio/src/app/page.tsx†L93-L210】【F:podcast-studio/src/app/studio/page.tsx†L40-L140】
- **Preserve input hygiene**: Topic sanitization lives in both backend (`sanitize_input`, Pydantic validators) and frontend proxy validation. Keep them consistent when expanding accepted formats.【F:backend/main.py†L139-L187】【F:podcast-studio/src/app/api/papers/route.ts†L1-L61】
- **Respect realtime lifecycles**: Always start a session (`/api/rt/start` or WebRTC handshake) before pushing audio/text, and ensure you stop or clean up sessions to prevent orphaned WebSocket connections.【F:podcast-studio/src/app/api/rt/start/route.ts†L1-L64】【F:podcast-studio/src/app/api/rt/stop/route.ts†L1-L18】
- **Maintain UI consistency**: Follow the design tokens in `globals.css` and reuse shadcn components; avoid inline styles that break the gradient/dark theme system.【F:podcast-studio/src/app/globals.css†L1-L120】【F:podcast-studio/src/components/ui/AGENT.md†L1-L121】
- **Logging**: Both services emit structured console logs; keep them informative and avoid leaking secrets. Prefer `logger.info`/`console.log` patterns already present.【F:backend/main.py†L18-L24】【F:podcast-studio/src/lib/realtimeSession.ts†L1-L63】
- **Documentation**: When adding a new workflow step or dependency, update `README.md` and relevant `AGENT.md` files so future agents understand the change.

---

Use this handbook to orient yourself, then rely on the scoped `AGENT.md` files for detailed conventions inside each service. Keep the backend and frontend in sync, run the recommended checks, and verify realtime flows whenever you touch OpenAI integration.
