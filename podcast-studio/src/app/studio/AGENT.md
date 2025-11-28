# Audio Studio Agent Guide

## Purpose
`src/app/studio/page.tsx` renders the realtime production workspace. It restores the paper selected
on the Research Hub, manages OpenAI realtime sessions via Next.js API routes, streams
microphone audio, displays transcripts, and exposes export/handoff tooling for downstream pages.
The component is a client component rendered under `SidebarProvider` and `ApiConfigProvider`.

## Architecture Overview
The Audio Studio uses a **Next.js API Routes architecture** for realtime communication:

1. **Session Management**: HTTP calls to `/api/rt/start` and `/api/rt/stop`
2. **Audio Input**: POST requests to `/api/rt/audio-append` for mic chunks
3. **Audio Output**: SSE stream from `/api/rt/audio` for AI audio playback
4. **AI Transcripts**: SSE stream from `/api/rt/transcripts` for AI text
5. **User Transcripts**: SSE stream from `/api/rt/user-transcripts` for speech detection and transcription
6. **Paper Context**: Pre-fetched via `/api/papers/fetch-text` before session starts

This architecture consolidates all realtime logic into the Next.js server, eliminating the need
for a separate Python WebSocket backend for conversations.

## Layout & Context
- Uses `Sidebar` from the shared layout. Passes `isLiveRecording` to `Sidebar` so the
  LIVE badge mirrors the recording state.
- Restores the selected paper from `sessionStorage` (`vps:selectedPaper`) on mount and listens for
  `storage` events so multi-tab selections stay in sync.
- Responsive 12-column grid layout: left sidebar (paper + controls) and Live Feed area.
- Full viewport height with fixed Live Feed that scrolls internally.

## State & Refs Highlights
- Connection phase (`phase`): `idle` | `preparing` | `live` | `stopping`
- Recording flags (`isRecording`, `isAudioPlaying`), timers (`sessionDuration`)
- Transcript entries (`entries`) with sequence-based ordering
- SSE stream refs: `audioStreamRef`, `transcriptStreamRef`, `userTranscriptStreamRef`
- Audio pipeline refs: `audioContextRef`, `mediaRecorderRef` for PCM16 encoding
- Audio chunks refs: `hostAudioChunksRef`, `aiAudioChunksRef` for saving conversations
- Session control states: `isMuted`, `isPaused` for mic control and session pause

## Key Features

### Paper Context Pre-fetching
- When a paper is selected, the full text is fetched via `/api/papers/fetch-text`
- Shows "Loading context…" indicator while fetching
- Shows "Context Ready" badge when loaded
- Disables "Start Session" button until context is loaded

### Session Control Buttons
1. **Start Session**: Initiates the realtime connection with OpenAI
2. **Pause Session**: Temporarily stops audio input/output without ending the session
3. **Resume Session**: Continues a paused session
4. **End Session**: Stops the session and saves the conversation

### Mute Functionality
- Mute button in Live Feed header during active sessions
- Disables microphone track and stops speech recognition
- Visual indicator (red when muted)

### Auto-scroll Transcript
- Live Feed has fixed height filling the viewport
- Transcript auto-scrolls to show the latest message
- Uses Radix UI ScrollArea for internal scrolling
- Page itself does not scroll - only the transcript area

### Optimistic Speech Recognition
- Uses Web Speech API for instant local transcription
- Falls back gracefully if not supported
- Server-side transcription provides final corrections

## Session Management Workflow
1. **Start (`startSession`)**
   - Calls `POST /api/rt/start` with `{sessionId, provider, paper}`.
   - On success, sets up three SSE streams via `setupSseStreams()`:
     - `/api/rt/audio` for AI audio playback
     - `/api/rt/transcripts` for AI transcript deltas
     - `/api/rt/user-transcripts` for user speech events and transcription
   - Starts the microphone pipeline via `startMicrophonePipeline()`.
   - Microphone audio is sent as base64 PCM16 to `POST /api/rt/audio-append`.

2. **SSE Stream Handling**
   - Audio stream: Receives base64 PCM16, decodes and plays via Web Audio API
   - Transcript stream: Receives AI text deltas, appends to current AI segment
   - User transcript stream: Handles `speech-started`, `speech-stopped`, `delta`, and `complete` events

3. **Pause (`togglePause`)**
   - Pausing: Disables audio track, stops speech recognition, suspends AudioContext
   - Resuming: Re-enables audio track, restarts speech recognition, resumes AudioContext
   - Shows status message for user feedback

4. **Stop (`stopSession`)** 
   - Stops microphone capture
   - Closes all SSE streams via `closeSseStreams()`
   - Calls `POST /api/rt/stop` to cleanup server resources
   - Builds and saves conversation payload for Video Studio

## Microphone Pipeline
- `startMicrophonePipeline` requests microphone permission, initialises a 24 kHz `AudioContext`
- Uses `ScriptProcessor` to convert Float32 buffers to PCM16
- PCM chunks are sent immediately to `/api/rt/audio-append` as base64
- Also stored locally in `hostAudioChunksRef` for saving conversations
- Respects mute state - doesn't send audio when muted

## Transcripts & Messages
- Messages are stored as `TranscriptEntry` objects with sequence-based ordering
- Chat-style layout: Host messages on right, AI messages on left
- Typewriter effect via `drainPending` and typing intervals for AI
- `finalizeSegment` commits the current segment when speech ends
- Auto-scroll maintained via `scrollToLatest` using Radix ScrollArea viewport

## Conversation Storage & Exports
- `buildConversationPayload` gathers the current conversation, merges AI/user audio recordings via
  `encodePcm16ChunksToWav`, and returns a `StoredConversation` payload.
- `stopSession` and `handleSendToVideoStudio` persist this payload with
  `saveConversationToSession`, enabling the Video Studio and Library to recover the session.
- Export helpers:
  - `handleExportTranscript` downloads a plain-text transcript.
  - `handleDownloadAudio` builds a ZIP archive containing AI/host WAV tracks, transcript text, and metadata JSON.

## Responsive Design
- Full responsiveness from mobile to 2xl screens
- 12-column grid: Paper/Controls (2-3 cols) + Live Feed (9-10 cols)
- Responsive text sizes, button heights, padding, and spacing
- Chat bubbles adjust width based on screen size
- Controls and indicators scale appropriately

## UI & Interaction Tips
- Disable controls appropriately: block multiple connect attempts, prevent recording when the
  session is not ready, and show inline status messages for errors.
- `statusMessage` surfaces non-blocking feedback; `error` displays blocking issues above the controls.
- Reset timers and preview buffers when tearing down sessions to avoid stale data.
- Button states use consistent color coding:
  - Start: White (active), gray (disabled)
  - Pause: Amber glow
  - Resume: Emerald glow
  - End: Red glow

## Testing Checklist
- Ensure the Next.js dev server is running (the Python backend is only needed for papers API)
- Select a paper in the Research Hub and confirm the "Current Paper" card populates
- Wait for "Context Ready" indicator before starting session
- Connect, record audio, observe transcript SSE streams, and ensure the remote audio plays
- Test Pause/Resume functionality - audio should stop/resume cleanly
- Test Mute functionality - your voice should not appear in transcript when muted
- Verify auto-scroll keeps latest message visible without scrolling the entire page
- Use "Send to Video Studio" then open `/video-studio` to verify the conversation payload loads
- Download the audio bundle and confirm the ZIP contains WAV tracks, transcript, and metadata
- Exercise disconnect flows (stop while recording, refresh page) to ensure cleanup paths run
- Test on mobile and desktop to verify responsive layout
