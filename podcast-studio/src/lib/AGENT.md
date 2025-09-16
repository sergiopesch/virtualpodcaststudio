# Library Modules – Agent Guide

The `src/lib` directory contains utilities used by API routes and client components. The
realtime session manager is the heart of the server-side realtime workflow; treat it with
care.

```
src/lib/
├── realtimeSession.ts # Node-side singleton talking to OpenAI Realtime
├── utils.ts           # Tailwind-friendly `cn()` helper
└── AGENT.md           # This guide
```

## `realtimeSession.ts`
- Exports a hot-reload-safe singleton (`rtSessionManager`) that stores `RTManager` instances by
  `sessionId`. Each `RTManager` maintains a WebSocket connection to OpenAI and exposes helper
  methods used by API routes (`start`, `appendPcm16`, `commitTurn`, `sendText`, `stop`).
- Connection flow:
  1. `start()` verifies an API key, fetches `/v1/models` as a sanity check, and opens the
     realtime WebSocket.
  2. `_setupWebSocketHandlers` sends a `session.update` payload configuring modalities, voice,
     transcription, and server-side VAD. Modify this payload carefully—the Audio Studio assumes
     text+audio modes are enabled.
  3. Incoming events emit on the `EventEmitter` interface: `audio`, `transcript`,
     `user_transcript`, `user_transcript_delta`, `assistant_done`, `close`, and `error`.
     API routes under `src/app/api/rt` stream these events back to the browser via SSE.
  4. `responseInFlight` prevents duplicate `response.create` calls. When you add new event types,
     update `_handleEvent` to keep this guard accurate.
- Session cleanup: `RTSessionManager.removeSession` calls `stop()` and clears timeouts. Idle
  sessions auto-expire after 30 minutes. Always go through the manager (never instantiate
  `RTManager` directly) so cleanup runs reliably.
- Provider support: only `openai` is implemented. The Google branch throws a descriptive error.
  If you implement another provider, update `configure`, `_establishConnection`, and the API
  routes to accept provider-specific headers.

## `utils.ts`
- Simple `cn()` helper that merges class names using `clsx` + `tailwind-merge`. Use it everywhere
  you compose Tailwind classes to avoid conflicting utilities.

## Implementation Guidelines
- Keep `realtimeSession.ts` Node-compatible. App Router API routes import it with
  `export const runtime = "nodejs";`. Avoid referencing browser APIs inside the module.
- When adding new events to the emitter, document them in the `src/app/api/rt/AGENT.md` (see
  below) and update any SSE consumers in the Audio Studio.
- Logging uses `log.info/error/warn/debug`; keep logs concise and avoid printing raw audio buffers
  or secrets.

## Testing
- Start the Next.js dev server and hit `/api/rt/start`, `/api/rt/status`, `/api/rt/audio` etc.
  while watching server logs to ensure events trigger as expected.
- Use a standalone Node script to instantiate `rtSessionManager.getSession('test')` and exercise
  `start()`/`sendText()` when experimenting with new provider settings.
