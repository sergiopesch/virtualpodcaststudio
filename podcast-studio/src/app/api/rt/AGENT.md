# Realtime API Routes – Agent Guide

All files in this folder proxy browser requests to the server-side `rtSessionManager`
(`src/lib/realtimeSession.ts`). They run on the Node.js runtime and must remain server-only
(avoid importing client modules).

```
src/app/api/rt/
├── start/route.ts          # Bootstrap or reconfigure a session
├── status/route.ts         # Inspect session state
├── stop/route.ts           # Tear down a session
├── webrtc/route.ts         # SDP exchange with OpenAI
├── audio-append/route.ts   # Upload PCM16 chunks
├── audio-commit/route.ts   # Signal end-of-turn for audio
├── text/route.ts           # Send typed messages
├── audio/route.ts          # SSE stream of assistant audio (base64 PCM16)
├── transcripts/route.ts    # SSE stream of assistant text deltas
├── user-transcripts/route.ts # SSE stream of user speech transcripts
└── AGENT.md                # This guide
```

## Lifecycle Overview
1. **`POST /api/rt/start`** – Configures a session with `{sessionId, provider, apiKey, model}`.
   Uses `rtSessionManager.getSession(sessionId)` and calls `configure()` + `start()`. Returns
   `{ok, status, provider}` or surfaces meaningful error messages (missing API key,
   authentication failure, timeout, etc.).
2. **`POST /api/rt/webrtc`** – Accepts a browser SDP offer, forwards it to OpenAI (`/v1/realtime`)
   with the resolved API key/model, and returns the SDP answer. Only the `openai` provider is
   supported (others return 501).
3. **Realtime traffic** – After `start()` succeeds:
   - Upload microphone data via `/api/rt/audio-append` (base64 PCM16) followed by
     `/api/rt/audio-commit` once a batch is flushed.
   - Send typed chat via `/api/rt/text`.
   - Subscribe to SSE endpoints for assistant audio (`/audio`), assistant text (`/transcripts`),
     and user speech transcripts (`/user-transcripts`). Each handler listens to corresponding
     `EventEmitter` events and cleans up listeners when the stream closes.
4. **`POST /api/rt/stop`** – Removes the session from the manager, closing sockets and clearing
   auto-cleanup timers.
5. **`GET /api/rt/status`** – Diagnostic endpoint returning `{status, isActive, isStarting,
   provider, model, activeSessionCount}` to help verify the manager state.

## Implementation Notes
- Every route sets `export const runtime = "nodejs";` (either explicitly or implicitly). Do not
  import `next/headers`/`cookies` since they are not available in the Node runtime when using
  streaming responses.
- SSE routes (`audio`, `transcripts`, `user-transcripts`) construct a `ReadableStream`. Attach
  `manager.on(...)` listeners inside `start()` and store cleanup functions on the controller so
  `cancel()` removes listeners and clears intervals. Always send an initial message so clients
  know the stream is alive.
- Error handling: catch exceptions from manager methods and return structured JSON with `{error,
  sessionId}` where helpful. Honor HTTP status codes (e.g., 503 when the session is not active).
- Keep logging informative but not noisy; the session manager already writes detailed logs.

## Extending the API
- When adding new realtime capabilities (e.g., file uploads, conversation commands), extend
  `realtimeSession.ts` first, then mirror the behaviour in a new route under this directory.
- Document any new EventEmitter names in both this file and the session manager AGENT so client
  consumers know what to expect.
- Maintain the session ID convention: the Audio Studio uses `session_${Date.now()}` and passes it
  on every request; new routes should accept the same parameter to keep multiplexing working.

## Testing
- With the dev server running, issue:
  - `POST /api/rt/start` (supply `sessionId` and API key in the body).
  - `GET /api/rt/status?sessionId=...` to verify `status === 'active'`.
  - Stream from `/api/rt/audio?sessionId=...` using `curl` or browser DevTools and confirm base64
    frames arrive.
  - Send text via `POST /api/rt/text` and watch `/api/rt/transcripts` for deltas.
  - Call `/api/rt/stop` and ensure SSE streams close promptly.
