# 🎙️ Conversation Testing & Debugging Guide

## Overview
This guide will help you test and verify that the live conversation feature with OpenAI's Realtime API is working correctly.

---

## 🔧 Recent Fixes Applied

### 1. Session Configuration
- ✅ Fixed audio format configuration (PCM16)
- ✅ Removed redundant `enabled: true` from transcription config
- ✅ Added proper session update logging
- ✅ Changed `input_audio_buffer.create` to `input_audio_buffer.clear`

### 2. Turn Commitment
- ✅ Simplified commitTurn to only commit buffer (removed redundant conversation item creation)
- ✅ Added 100ms delay between commit and response request
- ✅ Added comprehensive logging for debugging
- ✅ Added validation to skip commits when no audio chunks present

### 3. Event Handling
- ✅ Added support for all OpenAI event types:
  - `response.text.delta`, `response.audio_transcript.delta`, `response.content_part.added`
  - `response.audio.delta`, `response.audio_transcript.delta`
  - `input_audio_buffer.transcription.delta` and `.completed`
  - `input_audio_buffer.speech_started` and `.speech_stopped`
- ✅ Enhanced error handling for audio decoding
- ✅ Better logging for all events

### 4. Frontend Enhancements
- ✅ Added detailed logging for session start
- ✅ Added logging for audio commit operations
- ✅ Better error reporting with status codes

---

## ✅ Pre-Flight Checklist

Before testing, ensure:

1. **Environment Variables**
   ```bash
   # Check your .env.local file has:
   OPENAI_API_KEY=sk-...
   ```

2. **Services Running**
   ```bash
   # Terminal 1 - Backend (if you're using it)
   cd backend
   source venv/bin/activate
   uvicorn main:app --reload

   # Terminal 2 - Frontend
   cd podcast-studio
   npm run dev
   ```

3. **Browser Console Open**
   - Press F12 or Cmd+Option+I
   - Keep the Console tab visible to monitor logs

4. **Microphone Access**
   - Ensure your browser has microphone permissions
   - Test your mic in System Settings first

---

## 🧪 Step-by-Step Testing

### Step 1: Start the Session

1. Navigate to http://localhost:3000
2. (Optional) Select a paper from Research Hub and click "Start Audio Studio"
3. In the Audio Studio, click **"Start Live Session"**
4. Grant microphone permission when prompted

**Expected Console Logs:**
```
[INFO] Starting realtime session with config {sessionId: "...", provider: "openai", ...}
[INFO] [realtime:config] {sessionId: "...", provider: "openai", ...}
[INFO] [realtime:started] {sessionId: "...", duration: ..., ...}
[INFO] Realtime session started successfully {...}
[INFO] Attaching realtime streams...
[INFO] AI transcript EventSource created, waiting for events...
[INFO] AI transcript stream connected successfully
[INFO] User transcript EventSource created, waiting for events...
[INFO] User transcript stream connected successfully
[INFO] AI audio EventSource created, waiting for events...
[INFO] AI audio stream connected successfully
[INFO] Starting microphone pipeline...
[INFO] Microphone pipeline started, beginning audio capture
[INFO] Session is now LIVE
```

**UI Should Show:**
- Status: "LIVE" (red)
- Timer starts counting
- Microphone indicator: "streaming in realtime"
- No error messages

---

### Step 2: Speak into the Microphone

1. Say something clearly, like: "Hello, can you hear me?"
2. Speak for 3-5 seconds
3. Stop speaking and wait

**Expected Console Logs (Backend - realtimeSession.ts):**
```
[INFO] Creating new input audio buffer
[DEBUG] Appending 2048 bytes (1 chunks accumulated)
[DEBUG] Appending 2048 bytes (2 chunks accumulated)
... (more appends as you speak)
[DEBUG] Received realtime event: input_audio_buffer.speech_started
[INFO] User speech started
[DEBUG] Received realtime event: input_audio_buffer.transcription.delta
[DEBUG] User transcript delta: "Hello"
[DEBUG] User transcript delta: " can"
[DEBUG] User transcript delta: " you"
[DEBUG] User transcript delta: " hear"
[DEBUG] User transcript delta: " me"
[DEBUG] Received realtime event: input_audio_buffer.speech_stopped
[INFO] User speech stopped
```

**Expected Console Logs (Frontend - page.tsx):**
```
[DEBUG] User transcript delta received: "Hello"
[DEBUG] Appending to host segment: Hello
[INFO] User speech started - creating transcript segment
[DEBUG] User transcript delta received: " can you hear me"
[INFO] Speech stopped detected - uploading chunks and committing turn
[INFO] Committing audio turn {sessionId: "...", micChunksQueued: 0, hostAudioChunks: ...}
[INFO] Audio turn committed successfully {...}
```

**UI Should Show:**
- Purple bubble with "Host (You)" appears
- Your transcript appears word-by-word (streaming effect)
- "Recording your voice…" indicator while speaking
- Transcript finalizes when you stop

---

### Step 3: Wait for AI Response

After you stop speaking, the AI should respond.

**Expected Console Logs (Backend):**
```
[INFO] Committing audio turn {chunkCount: ..., totalBytes: ..., durationEstimate: "~2.5s"}
[DEBUG] Sent input_audio_buffer.commit
[INFO] Requesting AI response {...}
[DEBUG] Received realtime event: response.audio.delta
[DEBUG] AI audio delta received (response.audio.delta): 4096 bytes
[DEBUG] Received realtime event: response.audio_transcript.delta
[DEBUG] AI transcript delta received (response.audio_transcript.delta): "Hello"
... (more deltas)
[DEBUG] Received realtime event: response.done
[INFO] AI response completed event: response.done
```

**Expected Console Logs (Frontend):**
```
[DEBUG] AI audio chunk received, size: 12345
[DEBUG] Playing AI audio chunk, duration: 0.255 s
[DEBUG] AI transcript delta received: Hello
[DEBUG] Appending to ai segment: Hello
[INFO] AI response complete - finalizing segment
```

**UI Should Show:**
- "Dr. Sarah is responding…" indicator
- Blue bubble with "Dr. Sarah" appears
- AI transcript appears word-by-word with typing animation
- AI audio plays through speakers
- "AI audio streaming" indicator while playing

---

### Step 4: Continue the Conversation

1. Wait for AI to finish responding
2. Speak again: "Yes, I can hear you. Can you tell me about machine learning?"
3. Observe the same pattern repeating

**Expected:**
- Automatic turn detection (you don't need to click anything)
- Smooth back-and-forth conversation
- All transcripts appear correctly
- Audio plays without glitches

---

### Step 5: End the Session

1. Click **"End Session"**
2. Wait for cleanup

**Expected Console Logs:**
```
[INFO] Wrapping up session...
[INFO] Cleaning up audio stream
[INFO] Cleaning up transcript stream
[INFO] Cleaning up user transcript stream
[INFO] Session closed - ending audio stream
```

**UI Should Show:**
- Status changes to "SAVING" then "IDLE"
- Success message: "Conversation saved for the Video Studio"
- Export buttons become enabled

---

## 🐛 Troubleshooting

### Issue: No Transcript Appears for User Speech

**Check:**
1. Console logs show `[INFO] User speech started`?
   - **NO** → Microphone not capturing. Check permissions.
   - **YES** → Continue...

2. Console shows `[DEBUG] Received realtime event: input_audio_buffer.transcription.delta`?
   - **NO** → OpenAI not sending transcription events
     - Check API key is valid
     - Verify session update was sent correctly
     - Check if `input_audio_transcription` config is in session update
   - **YES** → Continue...

3. Console shows `[DEBUG] User transcript delta received: "..."`?
   - **NO** → Event not reaching frontend SSE handler
     - Check `/api/rt/user-transcripts` stream is open
     - Check EventSource readyState is 1 (OPEN)
   - **YES** → Continue...

4. Console shows `[DEBUG] Appending to host segment: ...`?
   - **NO** → Frontend event handler not working
     - Check `handleUserTranscriptionDelta` is called
     - Check `appendToSegment` function
   - **YES** → Transcript should be appearing!

---

### Issue: No AI Response

**Check:**
1. Console shows `[INFO] Committing audio turn`?
   - **NO** → Commit not triggered
     - Check VAD detected speech end
     - Check `commitAudioTurn` was called
   - **YES** → Continue...

2. Console shows `[DEBUG] Sent input_audio_buffer.commit`?
   - **NO** → Commit failed to send
     - Check WebSocket is open
     - Check error logs
   - **YES** → Continue...

3. Console shows `[INFO] Requesting AI response`?
   - **NO** → Response request not sent
     - Check delay between commit and request
     - Check for errors
   - **YES** → Continue...

4. Console shows `[DEBUG] Received realtime event: response.audio.delta`?
   - **NO** → OpenAI not responding
     - Check API quota/limits
     - Check network connectivity
     - Verify model supports realtime
   - **YES** → Continue...

5. Console shows `[DEBUG] AI audio chunk received`?
   - **NO** → Event not reaching frontend
     - Check `/api/rt/audio` stream is open
     - Check EventSource is connected
   - **YES** → AI response is working!

---

### Issue: Audio Plays But No Transcript

**Check:**
1. Look for `[DEBUG] Received realtime event: response.audio_transcript.delta`
   - **YES** → Transcript events are being sent
   - **NO** → OpenAI might not be sending text deltas

2. Check if using correct event type:
   - Should handle: `response.text.delta`, `response.audio_transcript.delta`, `response.content_part.added`

3. Verify payload structure in console logs
   - Look for `delta`, `transcript`, or `text` fields

---

### Issue: Session Fails to Start

**Common Causes:**

1. **Missing API Key**
   ```
   Error: Missing API key for OpenAI
   ```
   **Fix:** Add `OPENAI_API_KEY` to `.env.local`

2. **Invalid API Key**
   ```
   Error: Invalid OpenAI API key
   ```
   **Fix:** Verify key starts with `sk-` and is valid

3. **Network Error**
   ```
   Error: Failed to connect to conversation server
   ```
   **Fix:** Check internet connection, try again

4. **WebSocket Timeout**
   ```
   Error: Timed out while establishing realtime connection
   ```
   **Fix:** Check firewall, VPN, or network restrictions

---

## 📊 Success Criteria

### Minimum Working State
- ✅ Session starts without errors
- ✅ Can speak and see own transcript
- ✅ AI responds with audio
- ✅ AI transcript appears
- ✅ Can have 3+ turn conversation
- ✅ Session ends cleanly

### Full Working State (Ideal)
- ✅ All of the above, plus:
- ✅ Turn detection is automatic (no manual clicks)
- ✅ Transcripts stream in real-time (word-by-word)
- ✅ Audio and text are synchronized
- ✅ No console errors during normal operation
- ✅ Memory usage stays reasonable
- ✅ Can export transcript and audio

---

## 🔍 Debugging Checklist

If something isn't working, check these in order:

1. **Environment**
   - [ ] `.env.local` has valid `OPENAI_API_KEY`
   - [ ] Frontend is running on port 3000
   - [ ] Browser console is open

2. **Session Start**
   - [ ] No errors in console when clicking "Start Live Session"
   - [ ] WebSocket connects to OpenAI (check logs)
   - [ ] Session update is sent with proper config
   - [ ] All three SSE streams connect successfully

3. **Audio Capture**
   - [ ] Microphone permission granted
   - [ ] Audio chunks being captured (check logs)
   - [ ] Chunks being uploaded to backend
   - [ ] Backend receives and appends chunks

4. **Transcription**
   - [ ] User speech events coming from OpenAI
   - [ ] Transcription deltas arriving
   - [ ] Deltas being forwarded to frontend
   - [ ] Frontend appending to transcript

5. **AI Response**
   - [ ] Commit is triggered after speech stops
   - [ ] Response request is sent
   - [ ] AI audio deltas arriving
   - [ ] AI transcript deltas arriving
   - [ ] Audio playing correctly
   - [ ] Transcript displaying correctly

6. **Cleanup**
   - [ ] Session ends without hanging
   - [ ] All streams close properly
   - [ ] No memory leaks
   - [ ] Conversation is saved

---

## 💡 Tips for Successful Testing

1. **Speak Clearly**
   - Use a good microphone
   - Reduce background noise
   - Speak at normal volume

2. **Wait for Responses**
   - Give AI 1-2 seconds to respond
   - Don't interrupt immediately
   - Let turn detection work

3. **Monitor Console**
   - Keep console open at all times
   - Look for `[ERROR]` lines
   - Note any `[WARN]` messages

4. **Test Edge Cases**
   - Very short utterances ("Hi")
   - Long utterances (30+ seconds)
   - Multiple rapid turns
   - Interrupting AI

5. **Browser Compatibility**
   - Test in Chrome first (best support)
   - Try Firefox if issues persist
   - Safari may have different behavior

---

## 📝 Reporting Issues

If you find issues, please note:

1. **What you did** (steps to reproduce)
2. **What you expected**
3. **What actually happened**
4. **Console logs** (copy relevant errors)
5. **Browser & OS** (e.g., Chrome 120 on macOS)
6. **Session details** (model, provider, paper selected)

---

## 🎯 Next Steps

Once basic conversation works:

1. Test with different papers/contexts
2. Try longer conversations (10+ turns)
3. Test export functionality
4. Monitor memory usage over time
5. Try different AI voices (change `voice` in session config)

---

## 📚 Additional Resources

- [OpenAI Realtime API Docs](https://platform.openai.com/docs/guides/realtime)
- [WebSocket API Reference](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Server-Sent Events Guide](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- Project Testing Checklist: `TESTING_CHECKLIST.md`
- Fixes Applied: `FIXES_APPLIED.md`

---

## ✅ Expected Full Flow Summary

```
1. User clicks "Start Live Session"
   → Backend: WebSocket connects to OpenAI
   → Backend: Session update sent with config
   → Frontend: Three SSE streams connect
   → Frontend: Microphone starts capturing

2. User speaks
   → Frontend: Audio chunks captured via ScriptProcessorNode
   → Frontend: Chunks queued and uploaded via /api/rt/audio-append
   → Backend: appendPcm16() sends chunks to OpenAI WebSocket
   → OpenAI: Server VAD detects speech start/stop
   → OpenAI: Sends transcription deltas
   → Backend: Emits user_transcript_delta events
   → Frontend: SSE delivers deltas to UI
   → UI: Displays transcript streaming word-by-word

3. User stops speaking
   → OpenAI: Sends speech_stopped event
   → Backend: Emits user_speech_stopped
   → Frontend: Calls commitAudioTurn()
   → Backend: commitTurn() sends input_audio_buffer.commit
   → Backend: Sends response.create
   → OpenAI: Generates response

4. AI responds
   → OpenAI: Sends audio deltas
   → Backend: Emits audio events
   → Frontend: Plays audio via Web Audio API
   → OpenAI: Sends transcript deltas
   → Backend: Emits transcript events
   → Frontend: Displays AI transcript streaming
   → OpenAI: Sends response.done
   → Backend: Emits assistant_done
   → Frontend: Finalizes AI transcript segment

5. Repeat steps 2-4 for conversation

6. User clicks "End Session"
   → Frontend: Stops microphone
   → Frontend: Closes all SSE streams
   → Backend: Closes WebSocket
   → Frontend: Saves conversation to session storage
   → UI: Shows "Conversation saved" message
```

---

**Good luck with testing! 🚀**

