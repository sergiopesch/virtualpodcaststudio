# 🔍 Audio Studio Debug Checklist

Follow these steps in order. **Stop at the first ❌ and fix it before continuing.**

## Step 1: Basic Setup Check

### 1A. Backend Environment
1. Check that backend `.env` file has `OPENAI_API_KEY=your_key_here`
2. Start backend: `cd backend && source venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8000 --reload`
3. Verify backend logs show: `✅ OpenAI session ready successfully`

### 1B. Frontend Setup  
1. Start frontend: `cd podcast-studio && npm run dev`
2. Go to http://localhost:3000/studio
3. Open browser DevTools → Console tab

## Step 2: Test Microphone & Audio Processing

### 2A. Click "Start Voice Recording"
**Expected logs in browser console:**
```javascript
🎵 AudioContext created, actual sample rate: 48000 (or 44100)
🎤 Microphone access granted
✅ Session ready - WebSocket connected successfully
✅ PCM16 recording started successfully
```

**❌ If you see permission denied:** Allow microphone access and try again

### 2B. Speak for 2-3 seconds
**Expected logs (should appear ~25 times per second):**
```javascript
🔊 Audio chunk processed, length: 1280
📤 Sending PCM16 audio data to WebSocket, base64 length: 1280
```

**❌ If NO audio chunk logs appear:**
- AudioWorklet is not processing
- Check DevTools → Sources → Look for "pcm16-processor" 
- In console, type: `audio.audioContext.state` (should be "running")

## Step 3: Check WebSocket Data Flow

### 3A. Network Tab Check
1. DevTools → Network → WS tab
2. Click on the `/ws/conversation` connection
3. Go to "Messages" tab
4. Speak for 2-3 seconds

**Expected:** Outgoing messages every ~40ms:
```json
{"type":"audio","audio":"<long base64 string>"}
```

**❌ If no outgoing audio messages:**
- `sendAudioChunk()` is not being called
- Check that `state.isConnected` and `state.isSessionReady` are both true

### 3B. Backend Logs Check
While speaking, backend terminal should show:
```bash
🎤 Processing audio chunk from client
input_audio_buffer.append sent to OpenAI
```

**❌ If backend shows nothing while Network shows outgoing frames:**
- WebSocket connection issue
- Check for CORS errors or connection drops

## Step 4: OpenAI Transcription Events

### 4A. Speech Detection
Within 1-2 seconds of speaking, backend should show:
```bash
🎤 User started speaking
🔇 User stopped speaking
```

### 4B. Transcription Events
After stopping speech, backend should show:
```bash
📝 Live transcription update: ...
✅ Transcription completed: ...
```

**❌ If speech events appear but no transcription:**
- OpenAI audio encoding issue
- Check that base64 audio data is valid
- Try lowering VAD threshold in backend config

## Step 5: Frontend Transcription Display

### 5A. Browser Console
When transcription happens, browser should show:
```javascript
📝 Live transcription update: ...
✅ Final transcription: ...
```

### 5B. UI Display
- Transcribed text should appear in the "Live Transcript" section
- You should see your words appear in real-time

**❌ If backend logs transcription but browser doesn't show:**
- Check Network → WS → Messages for incoming transcription events
- Look for React state update issues

## Step 6: AI Response

### 6A. Backend Response Events
After transcription completes, backend should show:
```bash
💬 Text delta: Dr. Sarah: ...
🔊 Playing audio delta from AI
✅ Response completed
```

### 6B. Frontend Response Display
- AI response text should appear in Live Transcript
- You should hear AI voice response through speakers

## Quick Tests If Still Failing

### Test 1: Text-Only Mode
1. Instead of voice recording, type a message in the text input
2. Press Enter or click Send
3. You should get an AI response
4. **If text works but voice doesn't:** Audio processing is the issue

### Test 2: Check Audio Format
In browser console, when you see audio chunks:
```javascript
// Check if audio data looks valid (should be ~1280 chars)
console.log("Base64 length:", audioChunkData.length);
```

### Test 3: Manual WebSocket Test
1. Stop frontend
2. Use a WebSocket testing tool to connect to `ws://localhost:8000/ws/conversation`
3. Send: `{"type":"text","text":"hello"}`
4. You should get text responses back

## Common Issues & Fixes

### Issue: No Audio Chunks Generated
**Cause:** AudioWorklet not processing  
**Fix:** Ensure `numberOfOutputs: 1` and proper sink connection

### Issue: Session Never Ready
**Cause:** Backend not connecting to OpenAI  
**Fix:** Check OPENAI_API_KEY and internet connection

### Issue: No Transcription Events
**Cause:** Missing `input_audio_transcription` config  
**Fix:** Backend session config should include `"input_audio_transcription": {"model": "whisper-1"}`

### Issue: Audio Sent But No Response
**Cause:** OpenAI VAD not detecting speech  
**Fix:** Lower VAD threshold or add manual commit events

---

## 🚨 Report Your Results

For each step, note:
- ✅ Working as expected
- ❌ Failed at this step (include error messages)
- ⚠️ Partially working (describe what's different)

This will help pinpoint the exact failure location.
