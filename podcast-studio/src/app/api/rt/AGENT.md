# Realtime API Routes – Agent Guide

All handlers in `src/app/api/rt/` run on the Node.js runtime and proxy browser actions to the
server-side realtime session manager (`src/lib/realtimeSession.ts`). Do not import client
components or browser-only APIs inside this folder.

```
src/app/api/rt/
├── start/route.ts           # Configure + start a session
├── status/route.ts          # Inspect session state
├── stop/route.ts            # Tear down a session
├── webrtc/route.ts          # Exchange SDP offers with OpenAI
├── audio-append/route.ts    # Upload base64 PCM16 microphone chunks
├── audio-commit/route.ts    # Signal end-of-turn after uploading audio
├── text/route.ts            # Send typed messages
├── audio/route.ts           # SSE stream of assistant audio (base64 WAV frames)
├── transcripts/route.ts     # SSE stream of assistant transcript deltas
├── user-transcripts/route.ts# SSE stream of user speech transcripts + deltas
└── AGENT.md                 # This guide
```

## Lifecycle Overview
1. **Start (`POST /api/rt/start`)** – Reads `{sessionId, provider, apiKey, model, paper}`. Calls
   `manager.configure()` to set provider credentials and paper context, then `manager.start()` to
   establish the OpenAI WebSocket. Returns `{ok, status, provider, duration}` or `{error}` with an
   appropriate HTTP status (400 for missing key, 504 for timeouts, etc.).
2. **Status (`GET /api/rt/status`)** – Returns `{status, isActive, isStarting, provider, hasApiKey,
   model, activeSessionCount}` to aid debugging. Every call resets the session inactivity timer.
3. **WebRTC (`POST /api/rt/webrtc`)** – Accepts `{sessionId, sdp}` payloads, forwards them to the
   manager, which negotiates with OpenAI and returns the SDP answer. Currently only the `openai`
   provider is implemented.
4. **Streaming input** – After a session is active:
   - `POST /api/rt/audio-append` receives base64 PCM16, converts it to `Uint8Array`, and calls
     `manager.appendPcm16()`.
   - `POST /api/rt/audio-commit` finalises the turn via `manager.commitTurn()` which triggers a
     `response.create` event server-side.
   - `POST /api/rt/text` sends typed input through `manager.sendText()`.
5. **Streaming output** – SSE endpoints attach to the manager’s event emitters:
   - `/audio` listens to `audio`, emits base64 WAV frames and keep-alives.
   - `/transcripts` listens to `transcript` for assistant text deltas.
   - `/user-transcripts` listens to `user_transcript` (complete) and `user_transcript_delta`
     (interim) events. All streams register cleanup handlers and close when the session ends.
6. **Stop (`POST /api/rt/stop`)** – Calls `manager.stop()` and removes the session from the
   singleton. Clients should invoke this when disconnecting to release resources.

## Implementation Notes
- Every route either declares `export const runtime = "nodejs";` or relies on the default. Keep it
  that way so Node APIs (e.g., `Buffer`, `ReadableStream`) remain available.
- When extending `rtSessionManager` with new events, update the SSE handlers to wire up listeners
  and detach them on stream cancellation.
- Return structured `{ error, sessionId }` payloads with appropriate HTTP status codes on failure;
  the Audio Studio surfaces these messages directly to users.
- Avoid retaining per-request state at module scope. The manager already caches sessions and
  handles hot-reload safe singletons.

## Testing
- Start the dev server and issue:
  - `POST /api/rt/start` with a valid API key and session ID.
  - `GET /api/rt/status?sessionId=...` to verify the session is active.
  - Stream `/api/rt/audio?sessionId=...` using `curl` or browser DevTools to ensure base64 frames
    arrive.
  - Send text via `POST /api/rt/text` and watch `/api/rt/transcripts` for deltas.
  - Call `/api/rt/stop` and ensure SSE streams close and status returns to `inactive`.
