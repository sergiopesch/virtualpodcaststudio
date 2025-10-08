# 🎙️ Virtual Podcast Studio

A full-stack workspace for turning research papers into AI-assisted podcast episodes. The project
combines a FastAPI backend for arXiv ingestion + realtime OpenAI bridging with a Next.js frontend
that guides creators from discovery through post-production.

## ✨ Key Capabilities
- **Research Hub** – Accessible topic toggles, deduplicated arXiv results, and a handoff flow that
  persists the selected paper to the Audio Studio.
- **Audio Studio** – WebRTC microphone capture with real-time speech-to-text transcription (server VAD), 
  AI responses from OpenAI Realtime API via custom Server-Sent Events streams, live transcript display
  with typing animations, synchronized audio playback, and export options (transcript download, 
  WAV/ZIP bundle with separate host/AI tracks).
- **Post-production dashboards** – Video Studio timeline editor, Library, Publisher, and Analytics
  pages that consume saved conversations for mock editing/publishing workflows.
- **Workspace settings** – Sidebar collapse state and API provider/credential management stored via
  React contexts, with localStorage hydration for persistent preferences.

## 📁 Repository Structure

| Path | Description |
| --- | --- |
| `backend/` | FastAPI app (`main.py`) with `/api/papers`, `/health`, and `/ws/conversation` endpoints plus OpenAI realtime bridge. |
| `podcast-studio/` | Next.js 15 App Router frontend (Research Hub, Audio Studio, Video Studio, Library, Publisher, Analytics, realtime API routes). |
| `quick_health_check.py` | CLI helper that verifies `backend/.env` includes `OPENAI_API_KEY` and confirms the FastAPI `/health` endpoint is reachable. |
| `README.md` | This guide. |

## 🔄 Architecture at a Glance
1. **Topic discovery** – The Research Hub posts to `POST /api/papers`. A Next.js proxy validates the
   payload and forwards it to FastAPI, which sanitises each topic, queries arXiv, de-duplicates
   results, and returns the newest papers first.
2. **Realtime session** – The Audio Studio starts a session via `POST /api/rt/start`, negotiates
   WebRTC with `/api/rt/webrtc`, streams microphone PCM chunks through `/api/rt/audio-append` +
   `/api/rt/audio-commit`, and listens to Server-Sent Events for assistant audio (`/audio`) and
   transcripts (`/transcripts`, `/user-transcripts`). A legacy WebSocket fallback remains available at
   `backend/ws/conversation`.
3. **Conversation storage** – Finished sessions are serialised with
   `src/lib/conversationStorage.ts`, saved in `sessionStorage`, and consumed by the Video Studio,
   Library, and Publisher pages.

```
Browser (Research Hub & Studios)
   │  fetch /api/papers
   ▼
Next.js API route ──► FastAPI (`/api/papers`) ──► arXiv API
   │
   ├─► Realtime routes (`/api/rt/*`) ──► RT session manager ──► OpenAI Realtime
   └─► sessionStorage (selected paper / saved conversation)
```

## ⚙️ Setup

### Prerequisites
- **Node.js 18+** (20 recommended)
- **Python 3.8+**
- **OpenAI API key** with access to the Realtime API

### 1. Configure Environment Variables
Create `backend/.env` with at least:
```bash
OPENAI_API_KEY=sk-...
# Optional: ALLOWED_ORIGINS, OPENAI_REALTIME_MODEL, OPENAI_REALTIME_VOICE
```

Create `podcast-studio/.env.local` with (if you want to provide a server-side fallback key or custom
endpoints):
```bash
OPENAI_API_KEY=sk-...          # used only by Next.js API routes when the user has not provided one
# Optional: OPENAI_REALTIME_MODEL, OPENAI_REALTIME_VOICE
# Optional: BACKEND_URL, NEXT_PUBLIC_BACKEND_URL (default http://localhost:8000)
```

### 2. Install Dependencies
```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Frontend
cd ../podcast-studio
npm install
```

### 3. Run the Stack
```bash
# Terminal 1 – FastAPI backend
cd backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 – Next.js frontend
cd podcast-studio
npm run dev
```
Visit **http://localhost:3000/studio** to open the Audio Studio (or `/` for the Research Hub).

### 4. Quick Health Check
Run `python quick_health_check.py` from the repo root to verify the backend is running and the
OpenAI key is configured. The frontend also exposes `GET /api/test-openai` to confirm credentials can
list models.

## 🧠 Realtime Workflow Cheat Sheet
1. Select a paper in the Research Hub. The card’s “Start Audio Studio” button stores the selection in
   `sessionStorage` and navigates to `/studio`.
2. In the Audio Studio, open the workspace settings sheet to provide API credentials (if you do not
   want to rely on server-side keys) and click **Connect**.
3. When ready, click **Start Voice Recording**. Microphone audio is chunked to
   `/api/rt/audio-append`, committed via `/api/rt/audio-commit`, and streamed back as AI audio/text.
4. Use the controls on the right to export transcripts, download audio bundles, or send the session to
   the Video Studio for post-production.
5. Disconnect when finished—this stops microphone capture, tears down the WebRTC session, and saves
   the conversation for downstream pages.

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
  update `BACKEND_URL` / `NEXT_PUBLIC_BACKEND_URL`.
- **Realtime session errors** – Confirm `/api/rt/start` returns `{ ok: true }` in the network tab and
  that your API key has access to OpenAI Realtime. Missing keys surface as HTTP 400/503 responses.
- **No audio or transcript** – Check browser microphone permissions and verify SSE endpoints (audio,
  transcripts, user transcripts) are open in the network inspector. Look for EventSource connections
  in the Network tab with `readyState: 1` (open). Check console logs for
  `Received realtime event: input_audio_buffer.transcription.delta` while speaking and
  `response.text.delta` while the AI responds.
- **Transcription not appearing** – Open browser console and verify you see:
  - `[INFO] User speech started - creating transcript segment` when you speak
  - `[DEBUG] User transcript delta received:` with your words as you talk
  - `[DEBUG] AI transcript delta received:` when AI responds
  - If these logs are missing, check that the realtime session is active and streams are connected.
- **Workspace settings not persisting** – Only provider + model selections persist via localStorage.
  API keys intentionally reset on refresh for security.

## 🤝 Contributing
1. Fork the repository and create a feature branch (no force pushes to `main`).
2. Keep backend/frontend schemas in sync and update the relevant `AGENT.md` + README sections.
3. Run `npm run lint` and exercise the realtime workflow before opening a PR.
4. Submit the PR with a clear summary of changes.

## 📄 License
MIT License – see [LICENSE](./LICENSE) for details.
