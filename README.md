# 🎙️ Virtual Podcast Studio

A full-stack workspace for turning research papers into AI-assisted podcast episodes. The project
combines a FastAPI backend for arXiv ingestion with a Next.js frontend that handles realtime
AI conversations and guides creators from discovery through post-production.

## ✨ Key Capabilities
- **Research Hub** – Accessible topic toggles, deduplicated arXiv results, and a handoff flow that
  persists the selected paper to the Audio Studio.
- **Audio Studio** – Microphone capture with real-time speech-to-text transcription (server VAD), 
  AI responses from OpenAI Realtime API via Server-Sent Events streams, live transcript display
  with typing animations, synchronized audio playback, and export options (transcript download, 
  WAV/ZIP bundle with separate host/AI tracks).
- **Post-production dashboards** – Video Studio timeline editor, Library, Publisher, and Analytics
  pages that consume saved conversations for mock editing/publishing workflows.
- **Workspace settings** – Sidebar collapse state and API provider/credential management stored via
  React contexts, with localStorage hydration for persistent preferences.

## 📁 Repository Structure

| Path | Description |
| --- | --- |
| `backend/` | FastAPI app (`main.py`) with `/api/papers` and `/health` endpoints. |
| `podcast-studio/` | Next.js 15 App Router frontend (Research Hub, Audio Studio, Video Studio, Library, Publisher, Analytics) with realtime API routes that manage OpenAI connections server-side. |
| `quick_health_check.py` | CLI helper that verifies `backend/.env` includes `OPENAI_API_KEY` and confirms the FastAPI `/health` endpoint is reachable. |
| `README.md` | This guide. |

## 🔄 Architecture at a Glance

```
Browser (Research Hub & Studios)
   │  
   │  fetch /api/papers
   ▼
Next.js API route ──► FastAPI (`/api/papers`) ──► arXiv API
   │
   ├─► Realtime routes (`/api/rt/*`) ──► RT session manager ──► OpenAI Realtime API
   │     • POST /api/rt/start         (start session)
   │     • POST /api/rt/audio-append  (send mic audio)
   │     • GET  /api/rt/audio         (SSE: AI audio)
   │     • GET  /api/rt/transcripts   (SSE: AI text)
   │     • GET  /api/rt/user-transcripts (SSE: user speech)
   │     • POST /api/rt/stop          (end session)
   │
   └─► sessionStorage (selected paper / saved conversation)
```

### Flow
1. **Topic discovery** – The Research Hub posts to `POST /api/papers`. A Next.js proxy validates the
   payload and forwards it to FastAPI, which sanitises each topic, queries arXiv, de-duplicates
   results, and returns the newest papers first.
2. **Realtime session** – The Audio Studio starts a session via `POST /api/rt/start`, then opens
   SSE streams for audio and transcripts. Microphone audio is captured client-side and sent via
   `POST /api/rt/audio-append`. The Next.js server maintains a WebSocket connection to OpenAI's
   Realtime API and bridges events to the client via SSE streams.
3. **Conversation storage** – Finished sessions are serialised with `src/lib/conversationStorage.ts`,
   saved in `sessionStorage`, and consumed by the Video Studio, Library, and Publisher pages.

## ⚙️ Setup

### Prerequisites
- **Node.js 18+** (20 recommended)
- **Python 3.8+** (only needed for papers API)
- **OpenAI API key** with access to the Realtime API

### 1. Configure Environment Variables

Create `podcast-studio/.env.local` with:
```bash
OPENAI_API_KEY=sk-...          # Required for realtime conversations
# Optional: OPENAI_REALTIME_MODEL, OPENAI_REALTIME_VOICE
# Optional: BACKEND_URL, NEXT_PUBLIC_BACKEND_URL (default http://localhost:8000)
```

Create `backend/.env` (only needed for papers API):
```bash
OPENAI_API_KEY=sk-...          # Optional, only if using backend directly
# Optional: ALLOWED_ORIGINS
```

### 2. Install Dependencies
```bash
# Frontend (required)
cd podcast-studio
npm install

# Backend (optional, only for papers API)
cd ../backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Run the Stack
```bash
# Terminal 1 – Next.js frontend (required)
cd podcast-studio
npm run dev

# Terminal 2 – FastAPI backend (optional, only for papers)
cd backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Visit **http://localhost:3000/studio** to open the Audio Studio (or `/` for the Research Hub).

> **Note:** The Python backend is only required for the papers API. Realtime conversations are
> handled entirely by the Next.js server.

### 4. Quick Health Check
Run `python quick_health_check.py` from the repo root to verify the backend is running and the
OpenAI key is configured. The frontend also exposes `GET /api/test-openai` to confirm credentials
can list models.

## 🧠 Realtime Workflow Cheat Sheet
1. Select a paper in the Research Hub. The card's "Start Audio Studio" button stores the selection in
   `sessionStorage` and navigates to `/studio`.
2. In the Audio Studio, click **Start Live Session**. The page will:
   - Call `POST /api/rt/start` to initialize the session
   - Open SSE streams for audio and transcripts
   - Start microphone capture
3. Speak naturally – your audio is sent to `/api/rt/audio-append` and transcribed via OpenAI's VAD.
   The AI responds with audio and text streamed back via SSE.
4. Use the controls to export transcripts, download audio bundles, or send the session to the
   Video Studio for post-production.
5. Click **End Session** when finished – this stops microphone capture, tears down SSE streams,
   and saves the conversation for downstream pages.

## 🧪 Development Scripts

| Location | Command | Purpose |
| --- | --- | --- |
| `podcast-studio/` | `npm run dev` | Start the Next.js dev server (Turbopack). |
|  | `npm run build` | Verify the production bundle. |
|  | `npm run lint` | Run ESLint (flat config). |
|  | `npm run start` | Serve the production build. |
| `backend/` | `uvicorn main:app --reload` | Run the FastAPI server with auto-reload. |
| Repo root | `python quick_health_check.py` | Validate configuration + backend health. |

## 🛠️ Troubleshooting
- **Backend not reachable** – Ensure `uvicorn` is running on port 8000. If you changed the port,
  update `BACKEND_URL` / `NEXT_PUBLIC_BACKEND_URL`. Note: The backend is only needed for the
  papers API.
- **Realtime session errors** – Confirm `/api/rt/start` returns `{ ok: true }` in the network tab and
  that your API key has access to OpenAI Realtime. Missing keys surface as HTTP 400/503 responses.
- **No audio or transcript** – Check browser microphone permissions and verify SSE endpoints (audio,
  transcripts, user transcripts) are open in the network inspector. Look for EventSource connections
  in the Network tab with `readyState: 1` (open).
- **Transcription not appearing** – Verify the realtime session is active and SSE streams are
  connected. Check the browser console for connection errors.
- **Workspace settings not persisting** – Only provider + model selections persist via localStorage.
  API keys intentionally reset on refresh for security.

## 🤝 Contributing
1. Fork the repository and create a feature branch (no force pushes to `main`).
2. Keep backend/frontend schemas in sync and update the relevant `AGENT.md` + README sections.
3. Run `npm run lint` and exercise the realtime workflow before opening a PR.
4. Submit the PR with a clear summary of changes.

## 📄 License
MIT License – see [LICENSE](./LICENSE) for details.
