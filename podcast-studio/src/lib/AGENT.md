# Library Modules – Agent Guide

`src/lib` houses utilities shared across API routes and client components. Changes here typically
impact multiple parts of the app—coordinate updates carefully.

```
src/lib/
├── realtimeSession.ts     # Node-side singleton that talks to OpenAI Realtime
├── conversationStorage.ts # sessionStorage helpers + PCM16 <-> WAV utilities
├── utils.ts               # Tailwind-friendly `cn()` helper
└── AGENT.md               # This guide
```

## `realtimeSession.ts`
- Exposes a hot-reload-safe singleton (`rtSessionManager`) that stores `RTManager` instances by
  `sessionId`. Each manager maintains an OpenAI realtime WebSocket connection and emits events the
  API routes forward to the browser.
- `configure()` normalises provider (`openai`/`google`), resolves API keys (preferring user-provided
  keys, falling back to server env vars for OpenAI), stores optional model overrides, and sanitises
  paper context fields (title, authors, abstract, etc.). When context changes while connected,
  `_pushSessionUpdate` sends updated instructions to OpenAI.
- `_doStart()` establishes the WebSocket connection with a 10 second timeout, sends an initial
  `session.update` payload (text+audio modalities, Whisper transcription, server VAD), and emits a
  `ready` event on success. Errors clear state and bubble up for the API route to surface.
- Event handling: `_handleEvent` listens for OpenAI messages and emits on the internal
  `EventEmitter` (`audio`, `transcript`, `user_transcript`, `user_transcript_delta`, `assistant_done`,
  `ready`, `close`, `error`). SSE routes subscribe to these events.
- Input helpers: `appendPcm16` queues audio frames, `commitTurn` triggers `response.create`, and
  `sendText` submits text messages. `isActive()`/`isStarting()`/`getStatus()` report lifecycle state.
- Session cleanup: `removeSession` stops the WebSocket, clears inactivity timers (30-minute idle
  timeout), and removes the manager from the singleton. `cleanup()` tears down all sessions—useful in
  tests.

## `conversationStorage.ts`
- Defines the sessionStorage contract for saving/reloading the most recent conversation under
  `vps:latestConversation`. Includes interfaces for stored papers, transcript entries, audio tracks,
  and metadata.
- `encodePcm16ChunksToWav` converts raw PCM16 byte chunks into a base64 WAV with duration metadata;
  `decodeWavBase64` performs the inverse for the Video Studio waveform visualisation.
- `saveConversationToSession`, `loadConversationFromSession`, `clearConversationFromSession` guard
  against server usage by checking `typeof window !== 'undefined'`.
- Utility helpers (`toBase64`, `fromBase64`) support both browser (`btoa`/`atob`) and Node
  environments (using `Buffer`).

## `utils.ts`
- Currently exports `cn(...classes)` which combines `clsx` and `tailwind-merge`. Use this helper for
  composing Tailwind class strings to avoid conflicting utilities.

## Implementation Guidelines
- Keep `realtimeSession.ts` Node-compatible—API routes import it with `runtime = "nodejs"`. Avoid
  referencing browser APIs inside the module.
- When adding new realtime events, update the `/api/rt/*` routes to subscribe/unsubscribe properly
  and document the event name in the relevant AGENT files.
- Treat the conversation storage schema as shared API. If you evolve the structure, migrate existing
  stored payloads gracefully (`JSON.parse` should never throw) and update all consumers (Audio Studio,
  Video Studio, Library, Publisher).
- Logging helpers (`log.info`, `log.error`, etc.) already redact large payloads. Continue using them
  for consistency.

## Testing
- Start the Next.js dev server and exercise `/api/rt/start`, `/api/rt/status`, `/api/rt/audio`, etc.,
  watching the server logs produced by `realtimeSession.ts` for expected events.
- Use a Node REPL or script to import `rtSessionManager`, create a session, and send text/audio when
  experimenting with provider changes.
- Validate `conversationStorage.ts` helpers in the browser console (saving/loading) and within the
  Video Studio waveform rendering paths.
