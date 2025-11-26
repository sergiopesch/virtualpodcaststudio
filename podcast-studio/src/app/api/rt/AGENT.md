# Realtime API Routes – Agent Guide

All handlers in `src/app/api/rt/` run on the Node.js runtime and manage realtime conversations
with OpenAI. These routes are the **primary interface** for the Audio Studio's realtime
functionality – there is no separate backend WebSocket.

```
src/app/api/rt/
├── start/route.ts           # Configure + start a session
├── status/route.ts          # Inspect session state
├── stop/route.ts            # Tear down a session
├── webrtc/route.ts          # Exchange SDP offers with OpenAI (alternative to SSE)
├── audio-append/route.ts    # Upload base64 PCM16 microphone chunks
├── audio-commit/route.ts    # Signal end-of-turn after uploading audio
├── text/route.ts            # Send typed messages
├── audio/route.ts           # SSE stream of assistant audio (base64 PCM16)
├── transcripts/route.ts     # SSE stream of assistant transcript deltas
├── user-transcripts/route.ts# SSE stream of user speech transcripts + deltas
└── AGENT.md                 # This guide
```

## Architecture Overview

The Audio Studio uses these routes exclusively for realtime conversations:

```
Browser (Audio Studio)
    │
    ├─► POST /api/rt/start          → Initialize session
    │
    ├─► EventSource /api/rt/audio   → Receive AI audio (SSE)
    ├─► EventSource /api/rt/transcripts → Receive AI text (SSE)
    ├─► EventSource /api/rt/user-transcripts → Receive user speech events (SSE)
    │
    ├─► POST /api/rt/audio-append   → Send mic audio chunks
    │
    └─► POST /api/rt/stop           → End session
```

The server maintains a WebSocket connection to OpenAI's Realtime API via `RTManager` in
`src/lib/realtimeSession.ts`. Events from OpenAI are bridged to the browser via SSE streams.

## Lifecycle Overview

1. **Start (`POST /api/rt/start`)** – Reads `{sessionId, provider, apiKey, model, paper}`. Calls
   `manager.configure()` to set provider credentials and paper context, then `manager.start()` to
   establish the OpenAI WebSocket. Returns `{ok, status, provider, duration}` or `{error}` with an
   appropriate HTTP status (400 for missing key, 504 for timeouts, etc.).

2. **Status (`GET /api/rt/status`)** – Returns `{status, isActive, isStarting, provider, hasApiKey,
   model, activeSessionCount}` to aid debugging.

3. **Streaming Input** – After a session is active:
   - `POST /api/rt/audio-append` receives base64 PCM16, converts it to `Uint8Array`, and calls
     `manager.appendPcm16()`. OpenAI's server-side VAD detects speech boundaries.
   - `POST /api/rt/audio-commit` manually finalises the turn via `manager.commitTurn()` (optional,
     as VAD typically handles this automatically).
   - `POST /api/rt/text` sends typed input through `manager.sendText()`.

4. **Streaming Output** – SSE endpoints attach to the manager's event emitters:
   - `/audio` listens to `audio`, emits base64 PCM16 frames and keep-alives.
   - `/transcripts` listens to `transcript` for assistant text deltas, `assistant_done` for
     completion.
   - `/user-transcripts` listens to `user_transcript` (complete), `user_transcript_delta`
     (interim), `user_speech_started`, and `user_speech_stopped`. It emits `complete`, `delta`,
     `speech-started`, and `speech-stopped` SSE events so the Audio Studio can manage turn-taking.

5. **Stop (`POST /api/rt/stop`)** – Calls `manager.stop()` and removes the session from the
   singleton. Clients should invoke this when disconnecting to release resources. SSE streams
   automatically close when the session ends.

## Implementation Notes

- Every route declares `export const runtime = "nodejs";` so Node APIs (e.g., `Buffer`,
  `ReadableStream`) remain available.
- The start route normalises payloads via header fallbacks: `x-rt-session-id`, `x-llm-provider`,
  `x-llm-api-key`, and `x-llm-model` are honoured when the JSON body omits them.
- Incoming paper metadata is trimmed and length-limited so we never forward extremely long strings
  to OpenAI.
- When extending `rtSessionManager` with new events, update the SSE handlers to wire up listeners
  and detach them on stream cancellation.
- Return structured `{ error, sessionId }` payloads with appropriate HTTP status codes on failure;
  the Audio Studio surfaces these messages directly to users.
- Avoid retaining per-request state at module scope. The manager already caches sessions and
  handles hot-reload safe singletons.

## SSE Event Types

### `/api/rt/audio`
- `data: <base64>` – AI audio chunk (PCM16, 24kHz, mono)
- `: keep-alive` – Heartbeat every 15 seconds
- `event: error` – Error message

### `/api/rt/transcripts`
- `data: <text>` – AI transcript delta
- `event: done` – AI response complete
- `event: error` – Error message

### `/api/rt/user-transcripts`
- `event: delta` + `data: <text>` – Interim user transcription
- `event: complete` + `data: <text>` – Final user transcription
- `event: speech-started` – User started speaking
- `event: speech-stopped` – User stopped speaking
- `event: error` – Error message

## Testing

Start the dev server and issue:
1. `POST /api/rt/start` with a valid API key and session ID.
2. `GET /api/rt/status?sessionId=...` to verify the session is active.
3. Open `/api/rt/audio?sessionId=...` in the browser to see SSE connection.
4. Send audio via `POST /api/rt/audio-append` and watch `/api/rt/transcripts` for AI response.
5. Call `POST /api/rt/stop` and ensure SSE streams close and status returns to `inactive`.
