# Audio Studio Agent Guide

## Purpose
`src/app/studio/page.tsx` renders the realtime production workspace. It restores the paper
selected on the Research Hub, manages OpenAI realtime sessions (WebRTC + HTTP fallbacks), and
paints the multi-panel UI (transcript, controls, status sidebar).

The component is a client component that expects to run under the `SidebarProvider` and
`ApiConfigProvider` wrappers declared in `src/app/layout.tsx`.

## Anatomy
- **Layout chrome** – `Sidebar` and `Header` render navigation and status. Pass
  `isLiveRecording` to `Sidebar` so the "LIVE" badge tracks the recording state.
- **Paper context** – Handoff uses `sessionStorage` key `vps:selectedPaper`. Malformed payloads
  populate `paperLoadError` and surface a prompt to revisit the Research Hub.
- **Workspace settings** – `useApiConfig()` pulls the active provider + API keys from the
  Settings sheet (Sheet component). `ensureRealtimeSession` relies on this context before
  contacting the server.
- **Realtime state** – Flags for connection (`isConnected`, `isSessionReady`), recording
  (`isRecording`, `isConnecting`), and timers (`sessionDuration`). `messages` holds the curated
  transcript history rendered in the scroll area.
- **Refs** – Extensive refs manage audio streaming:
  - `pcRef`/`dcRef`/`aiTrackRef` – WebRTC peer connection, data channel, and remote audio track
    (for playback).
  - `audioContextRef`, `mediaRecorderRef`, `micChunkQueueRef`, `micFlushIntervalRef`,
    `isUploadingRef` – control microphone capture, PCM16 encoding, and batching flushes to
    `/api/rt/audio-append`.
  - `aiTextBufferRef`, `aiTypingIntervalRef`, `lastAiMessageIdRef` – animate AI text output.
  - `transcriptEndRef` – ensures auto-scroll as messages update.

## Research Hub Handoff
- On mount, read `sessionStorage.getItem('vps:selectedPaper')`. Store the parsed object in
  `currentPaper` and log parse errors (the UI shows a recovery message).
- Listen for `storage` events to support multi-tab workflows. If the user selects a new paper
  in another tab, this page immediately updates.
- Keep the stored schema (`SelectedPaper`) aligned with the writer in `src/app/page.tsx`.
  Added fields should degrade gracefully when missing.

## Provider & Session Management
- `ensureRealtimeSession` validates that the active provider is `openai` (the Google branch is
  not implemented yet) and that a usable API key exists. It then POSTs to `/api/rt/start` with
  `{sessionId, provider, apiKey, model}` allowing the server to bootstrap the
  `rtSessionManager` singleton.
- Session status polling is available via `/api/rt/status`; use it during debugging to verify
  the manager is active before sending audio.
- `handleDisconnect` and `teardownRealtime` must always stop microphone capture, clear timers,
  close the peer connection/data channel, and notify `/api/rt/stop` to release the session.

## Connection Workflow
1. **Connect (`handleConnect`)**
   - Calls `ensureRealtimeSession` (server boots session manager).
   - Creates a `RTCPeerConnection`, attaches microphone track, negotiates with
     `/api/rt/webrtc` (OpenAI SDP exchange), and opens a data channel (`oai-events`).
   - Once the data channel is ready, send a session settings payload to request audio + text
     modalities, voice, and VAD.
2. **Recording (`handleStartRecording` / `startMicrophoneRecording`)**
   - Requests microphone permission, creates a 24kHz `AudioContext`, and wires a ScriptProcessor
     that converts Float32 PCM to PCM16.
   - Queue PCM16 bytes in `micChunkQueueRef`; a 50 ms interval flush posts batched base64 to
     `/api/rt/audio-append`. Guard against concurrent uploads using `isUploadingRef`.
   - Call `/api/rt/audio-commit` after each flush to let OpenAI know the turn is complete.
3. **Text messages (`handleSendText`)**
   - POST to `/api/rt/text` after ensuring the session is active. Input is trimmed and cleared
     once the request resolves.
4. **Server events (`handleDcMessage`)**
   - Data-channel messages include AI response deltas, transcription updates, and errors. Parse
     cautiously and always guard unknown payloads with `try/catch`.
   - SSE listeners (see `useEffect` hooks near the bottom of the file) consume
     `/api/rt/audio`, `/api/rt/transcripts`, and `/api/rt/user-transcripts`. Each stream must
     be unsubscribed in `teardownRealtime` to avoid leaking connections.
5. **Disconnect (`handleStopRecording`, `handleDisconnect`, `teardownRealtime`)**
   - Stop mic processing, clear buffers/intervals, pause audio playback, close peer/data
     channels, and call `/api/rt/stop` to dispose of the server session.

## UI & Interaction Tips
- Auto-scroll the transcript by calling `scrollIntoView` on `transcriptEndRef` whenever
  `messages` or transcription preview changes.
- Disable buttons when `isConnecting`, `isRecording`, or `isSessionReady` states do not allow a
  given action to prevent accidental double submits.
- Keep empty/error states empathetic. The current implementation shows helpful messaging when
  there is no selected paper or when realtime setup fails.
- `sessionDuration` drives the timer pill in the header; ensure it resets in teardown paths.

## Testing Checklist
- Run `npm run lint` from the repository root (known upstream issues may still exist; document
  them in PRs).
- Manual:
  - Start the backend + frontend, select a paper, and confirm it appears in the "Current Paper"
    card.
  - Connect to the realtime session, speak into the mic, and verify audio plays back plus
    transcript/typing updates stream in.
  - Toggle Settings → Workspace to swap API keys/providers; confirm guardrails block non-OpenAI
    providers.
  - Disconnect and ensure timers/audio contexts stop, SSE streams close, and the sidebar LIVE
    badge clears.
