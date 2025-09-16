# Audio Studio Agent Guide

## 📌 Purpose
The Audio Studio (`page.tsx`) renders the realtime conversation workspace where a host can talk with an OpenAI-powered expert. It orchestrates the WebRTC session, streams microphone audio in PCM16 batches, and renders the combined live transcript with contextual UI cues.

## 🧭 Anatomy
- **Layout chrome**: Reuses `Sidebar` and `Header` for navigation, state banner, and timer.
- **Paper context**: Static card showing the active research paper (placeholder data today).
- **Recording controls**: Connect/record buttons, manual text input, transcript export, and disconnect actions.
- **Live transcript**: Scrollable conversation history with live typing animation, user transcription preview, and AI responses.
- **Hidden audio element**: Plays the expert voice returned over WebRTC.

## 🗄️ Core State & Refs
| Identifier | Type | Role |
| --- | --- | --- |
| `isConnected`, `isSessionReady`, `isRecording`, `isConnecting` | `boolean` | Connection lifecycle flags that guard user actions.
| `messages` | `ConversationMessage[]` | Persisted transcript entries rendered in the UI.
| `userTranscription` / `isTranscribing` | `string` / `boolean` | Live microphone transcription preview while server VAD is active.
| `mediaRecorderRef` | `MicrophoneProcessor \| null` | Wraps the ScriptProcessor pipeline so we can stop audio capture quickly.
| `pcRef` / `dcRef` / `aiTrackRef` | WebRTC handles | Track the active RTCPeerConnection, data channel, and remote audio track for cleanup.
| `aiTextBufferRef` / `aiTypingIntervalRef` | `string` / `number \| null` | Buffer incoming AI text deltas and drive the typing animation.
| `micChunkQueueRef` / `isUploadingRef` / `micFlushIntervalRef` | refs | Batch PCM16 frames and flush to `/api/rt/audio-append` every 50 ms without overlapping uploads.

Keep all cleanup logic in `teardownRealtime` so any exit path (manual disconnect, component unmount, fatal error) leaves no dangling audio context, timers, or interval handles.

## 🔌 Connection Workflow
1. **`handleConnect`**
   - Calls `ensureRealtimeSession` (`POST /api/rt/start`) before opening WebRTC.
   - Instantiates an `RTCPeerConnection`, attaches a send-only microphone track, and negotiates SDP with `/api/rt/webrtc`.
   - Creates a data channel (`oai-events`) to receive JSON payloads for AI responses, transcription events, and errors.
   - Updates session settings (`modalities`, `voice`, `turn_detection`) once the data channel opens.
2. **`handleStartRecording` / `startMicrophoneRecording`**
   - Requests mic access, creates a 24 kHz `AudioContext`, converts float PCM to PCM16, and queues bytes for the batching loop.
   - Flush loop concatenates queued chunks, base64-encodes them, and POSTs to `/api/rt/audio-append`.
3. **`handleSendText`**
   - Sends typed messages through `/api/rt/text` after confirming the session is live.
4. **`handleDcMessage`**
   - Parses data-channel JSON safely. Supports:
     - `response.*.delta` → buffer AI text for the typing animation.
     - `response.done` → flush buffers and reset message pointer.
     - `conversation.item.input_audio_transcription.*` → show live speech preview and emit committed user messages.
     - `response.error` → surface session errors to the UI.
5. **`handleStopRecording` / `handleDisconnect` / `teardownRealtime`**
   - Stop mic capture, close peer connection + data channel, dispose the audio context, and notify `/api/rt/stop`.

## 🖥️ UI Considerations
- Auto-scroll transcript via `transcriptEndRef` whenever messages or live transcription change.
- Guard user actions when `isConnected`/`isSessionReady` are false to avoid rejected API calls.
- Maintain empathetic empty states that guide hosts before the first AI response.
- Use semantic icons and consistent gradient backgrounds from the global theme.

## ✅ Testing & Debugging
Run `npm run lint` from the `podcast-studio/` directory before committing UI or logic changes. The command currently fails due to unrelated modules; still run it and note pre-existing failures in PR summaries.

Manual checklist:
- Connect, speak, and confirm AI audio plays.
- Verify text input sends messages and renders in transcript.
- Ensure disconnect/teardown clears timers, microphone, and transcript state.

## 🧠 When Extending
- **New transcript features**: Update `ConversationMessage` typings and make sure the render loop handles new message types gracefully.
- **Additional realtime events**: Extend `handleDcMessage` with explicit type guards. Avoid `any`; prefer discriminated unions.
- **Multiple experts**: Store participant metadata with each message and surface it in avatars + names.
- **State refactors**: Keep teardown idempotent and remember to clear `micChunkQueueRef` + `aiTypingIntervalRef`.

Keep this page resilient—treat WebRTC and realtime APIs as unstable networks and handle every promise rejection or parse failure defensively.
