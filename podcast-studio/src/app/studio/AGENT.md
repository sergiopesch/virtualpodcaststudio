# Audio Studio Agent Guide

## Purpose
`src/app/studio/page.tsx` renders the realtime production workspace. It restores the paper selected
on the Research Hub, manages OpenAI realtime sessions (WebRTC + HTTP fallbacks), streams
microphone audio, displays transcripts, and exposes export/handoff tooling for downstream pages.
The component is a client component rendered under `SidebarProvider` and `ApiConfigProvider`.

## Layout & Context
- Uses `Sidebar` and `Header` from the shared layout. Passes `isLiveRecording` to `Sidebar` so the
  LIVE badge mirrors the recording state.
- Reads provider/API key settings from `useApiConfig()`. `ensureRealtimeSession` merges those values
  with `.env.local` fallbacks before calling `/api/rt/start`.
- Restores the selected paper from `sessionStorage` (`vps:selectedPaper`) on mount and listens for
  `storage` events so multi-tab selections stay in sync.

## State & Refs Highlights
- Connection flags (`isConnecting`, `isConnected`, `isSessionReady`), recording flags
  (`isRecording`, `isAudioPlaying`), timers (`sessionDuration`), and messaging state (`messages`,
  `activeAiMessageId`, `statusMessage`, `error`).
- WebRTC refs: `pcRef`, `dcRef`, `aiTrackRef` handle the peer connection, data channel, and remote
  audio track.
- Audio pipeline refs: `audioContextRef`, `mediaRecorderRef`, `micChunkQueueRef`,
  `micFlushIntervalRef`, `isUploadingRef` manage PCM16 encoding and batching to the API routes.
- Transcript rendering uses `aiTextBufferRef`, `aiTypingIntervalRef`, and `transcriptEndRef` to
  animate streaming text and maintain auto-scroll.

## Session Management Workflow
1. **Connect (`handleConnect`)**
   - Calls `ensureRealtimeSession` to POST `/api/rt/start` with `{sessionId, provider, apiKey, model, paper}`.
   - Creates an `RTCPeerConnection`, opens a data channel (`oai-events`), and attaches the
     microphone track.
   - Sends the SDP offer to `/api/rt/webrtc`; applies the returned answer and waits for the data
     channel to open before sending initial session settings to OpenAI.
   - Registers SSE listeners for `/api/rt/audio`, `/api/rt/transcripts`, and
     `/api/rt/user-transcripts` via `startSseStream` helper effects. The user transcript stream also
     forwards `speech-started`/`speech-stopped` events that toggle host speaking indicators and
     trigger an `audio-commit` after flushing queued mic samples.
2. **Data channel handling (`handleDcMessage`)** – Parses JSON messages emitted by the server
   (assistant messages, transcript updates, error notifications). Guard unknown payloads with
   `try/catch` and log warnings instead of throwing.
3. **Status polling** – `getSessionStatus` (used for debugging) hits `/api/rt/status` to inspect the
   manager.
4. **Disconnect (`handleDisconnect` / `teardownRealtime`)** – Stops microphone capture, clears
   timers, closes the peer connection/data channel, detaches SSE streams, notifies `/api/rt/stop`,
   and resets local state. A `useEffect` cleanup ensures teardown runs on unmount.

## Microphone Pipeline
- `handleStartRecording` requests microphone permission, initialises a 24 kHz `AudioContext`, and
  pipes audio through a `ScriptProcessor` that converts Float32 buffers to PCM16 (`float32ToPcm16`).
- PCM chunks are enqueued in `micChunkQueueRef`. A 50 ms interval flush posts batched base64 to
  `/api/rt/audio-append`, guarded by `isUploadingRef` to prevent concurrent uploads.
- Once speech stops, `/api/rt/audio-commit` is invoked (after a final flush) so OpenAI produces a
  response.
- `handleStopRecording` stops the processor, clears intervals, commits any remaining audio, and
  updates UI state.
- Speech boundary events from the `/api/rt/user-transcripts` SSE feed call `uploadMicChunks` and
  `commitAudioTurn` so the AI responds immediately after the host stops speaking.

## Transcripts & Messages
- Messages are stored as `{id, role, content, timestamp, type, speaker, order}`. Helper utilities
  (`sortMessages`, `appendConversationMessage`, `updateAiMessage`) ensure deterministic ordering.
- `useEffect` hooks subscribe to SSE streams, update `messages`, and maintain preview text for the
  AI typing indicator.
- Auto-scroll is handled by calling `transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })`
  whenever transcripts update.
- Final transcript events replace the temporary streaming text for a segment rather than appending to
  the accumulated content. This prevents duplicated phrases when the realtime API sends a full
  transcript after incremental deltas.

## Conversation Storage & Exports
- `buildConversationPayload` gathers the current conversation, merges AI/user audio recordings via
  `encodePcm16ChunksToWav`, and returns a `StoredConversation` payload.
- `handleDisconnect` and `handleSendToVideoStudio` persist this payload with
  `saveConversationToSession`, enabling the Video Studio and Library to recover the session.
- Export helpers:
  - `handleExportTranscript` downloads a plain-text transcript.
  - `handleDownloadAudio` builds a ZIP archive (via `createZipArchive`) containing AI/host WAV
    tracks, transcript text, and metadata JSON.

## UI & Interaction Tips
- Disable controls appropriately: e.g., block multiple connect attempts, prevent recording when the
  session is not ready, and show inline status messages for errors.
- `statusMessage` surfaces non-blocking feedback; `error` displays blocking issues above the
  controls. Keep copy user-friendly.
- Reset timers and preview buffers when tearing down sessions to avoid stale data.

## Testing Checklist
- With backend + realtime APIs configured, select a paper in the Research Hub and confirm the
  “Current Paper” card populates.
- Connect, record audio, observe transcript/audio SSE streams, and ensure the remote audio plays.
- Use “Send to Video Studio” then open `/video-studio` to verify the conversation payload loads.
- Download the audio bundle and confirm the ZIP contains WAV tracks, transcript, and metadata.
- Exercise disconnect flows (stop while recording, refresh page) to ensure cleanup paths run without
  throwing.
