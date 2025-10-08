# 🧪 Testing Checklist - Virtual Podcast Studio

## Pre-Flight Checks

Before testing, ensure:
- ✅ Backend is running (`uvicorn main:app --reload`)
- ✅ Frontend is running (`npm run dev`)
- ✅ Health check passes (`python quick_health_check.py`)
- ✅ Browser console is open (F12) to monitor errors
- ✅ Microphone is connected and working

---

## 🎯 Critical Path Testing

### 1. Research Hub - Paper Discovery

**Test**: Basic Paper Fetching
- [ ] Navigate to http://localhost:3000
- [ ] Select at least one topic (e.g., cs.AI)
- [ ] Click "Fetch Papers"
- [ ] **Expected**: Papers load and display with titles, authors, abstracts
- [ ] **Expected**: No duplicate papers appear
- [ ] **Expected**: Papers are sorted by date (newest first)

**Test**: Topic Combinations
- [ ] Select multiple topics (e.g., cs.AI, cs.ML, cs.CL)
- [ ] Click "Fetch Papers"
- [ ] **Expected**: Results include papers from all selected topics
- [ ] **Expected**: Deduplication works across topics

**Test**: Error Handling
- [ ] Stop the backend server
- [ ] Try to fetch papers
- [ ] **Expected**: Clear error message appears
- [ ] **Expected**: UI doesn't crash
- [ ] Restart backend and try again
- [ ] **Expected**: Works after backend restart

### 2. Audio Studio - Session Management

**Test**: Paper Selection Handoff
- [ ] From Research Hub, click "Start Audio Studio" on any paper
- [ ] **Expected**: Navigate to /studio
- [ ] **Expected**: Selected paper details appear in "Current Paper" card
- [ ] **Expected**: Paper title, authors, and abstract are displayed correctly

**Test**: Session Initialization
- [ ] Click "Start Live Session"
- [ ] Allow microphone access when prompted
- [ ] **Expected**: Status changes to "CONNECTING" then "LIVE"
- [ ] **Expected**: Session timer starts counting
- [ ] **Expected**: No error messages appear
- [ ] **Expected**: Microphone indicator shows "streaming in realtime"

**Test**: Microphone Capture & Real-time Transcription
- [ ] With session live, speak into microphone
- [ ] Say something like "Hello, this is a test"
- [ ] **Expected**: "Recording your voice…" indicator appears
- [ ] **Expected**: User transcript appears in real-time as you speak (streaming effect)
- [ ] **Expected**: Purple transcript bubble shows your speech
- [ ] **Expected**: Host audio chunks are being captured (check console logs)
- [ ] **Expected**: Console shows `[INFO] User speech started - creating transcript segment`
- [ ] **Expected**: Console shows `[DEBUG] Received realtime event: input_audio_buffer.transcription.delta` and deltas with your words
- [ ] Stop speaking and wait 1-2 seconds
- [ ] **Expected**: Console shows `[INFO] Speech stopped detected`
- [ ] **Expected**: Transcript is finalized and turn commits

**Test**: AI Response & Transcription
- [ ] After speaking, wait for AI response
- [ ] **Expected**: "Dr. Sarah is responding…" indicator appears
- [ ] **Expected**: AI transcript appears with typing animation (word-by-word effect)
- [ ] **Expected**: Blue transcript bubble shows AI response
- [ ] **Expected**: AI audio plays through speakers synchronized with text
- [ ] **Expected**: Console shows `[DEBUG] Received realtime event: response.text.delta` with response text
- [ ] **Expected**: Console shows `[DEBUG] AI audio chunk received, size:` logs
- [ ] **Expected**: Transcript feed shows both host (purple) and AI (blue) messages in order
- [ ] **Expected**: Timestamps appear for each message

**Test**: Session End
- [ ] Click "End Session"
- [ ] **Expected**: Status changes to "SAVING" then "IDLE"
- [ ] **Expected**: Success message appears
- [ ] **Expected**: Conversation is saved (check "Send to Video Studio" button becomes enabled)
- [ ] **Expected**: All resources are cleaned up (check console for cleanup logs)

### 3. Conversational Flow

**Test**: Transcription Stream Connection
- [ ] Start a session with browser console open
- [ ] **Expected**: Console shows:
  - `[INFO] AI transcript EventSource created, waiting for events...`
  - `[INFO] AI transcript stream connected successfully`
  - `[INFO] User transcript EventSource created, waiting for events...`
  - `[INFO] User transcript stream connected successfully`
  - `[INFO] AI audio EventSource created, waiting for events...`
  - `[INFO] AI audio stream connected successfully`
- [ ] **Expected**: All three EventSource streams are in `readyState: 1` (open) in Network tab
- [ ] **Expected**: No errors about stream connection failures

**Test**: Multi-Turn Conversation
- [ ] Start a new session
- [ ] Have at least 5 back-and-forth exchanges
- [ ] **Expected**: All transcripts appear in order
- [ ] **Expected**: Auto-scroll keeps latest message visible
- [ ] **Expected**: Turn detection works automatically
- [ ] **Expected**: No audio glitches or dropouts
- [ ] **Expected**: Memory usage stays reasonable (<500MB)

**Test**: Interruptions
- [ ] Start speaking while AI is responding
- [ ] **Expected**: AI stops gracefully
- [ ] **Expected**: Your speech is captured
- [ ] **Expected**: New response is generated

**Test**: Long Pauses
- [ ] Speak, then wait 5-10 seconds
- [ ] **Expected**: AI responds after natural pause
- [ ] **Expected**: No timeout errors

### 4. Export Functionality

**Test**: Transcript Export
- [ ] After recording a session, click "Export Transcript"
- [ ] **Expected**: `podcast-transcript.txt` downloads
- [ ] Open the file
- [ ] **Expected**: Contains timestamps, speaker labels, and full text
- [ ] **Expected**: Format is readable and well-structured

**Test**: Audio Bundle Download
- [ ] Click "Download Audio Bundle"
- [ ] **Expected**: ZIP file downloads
- [ ] Extract the ZIP
- [ ] **Expected**: Contains:
  - `host-track.wav` (your voice)
  - `ai-track.wav` (AI voice)
  - `transcript.txt`
  - `metadata.json`
- [ ] Play both WAV files
- [ ] **Expected**: Audio is clear and synchronized
- [ ] Open metadata.json
- [ ] **Expected**: Contains paper info and duration

**Test**: Send to Video Studio
- [ ] Click "Send to Video Studio"
- [ ] **Expected**: Navigate to /video-studio
- [ ] **Expected**: Conversation data loads in Video Studio
- [ ] **Expected**: Timeline shows conversation segments

### 5. Error Scenarios

**Test**: Missing API Key
- [ ] Clear API key from .env.local
- [ ] Restart frontend
- [ ] Try to start a session
- [ ] **Expected**: Clear error message: "Missing API key for OpenAI"
- [ ] **Expected**: Link or instruction to configure in Settings

**Test**: Invalid API Key
- [ ] Set API key to `sk-invalid-key-test`
- [ ] Try to start a session
- [ ] **Expected**: Clear error message about invalid key
- [ ] **Expected**: Suggestion to verify key in Settings

**Test**: Network Interruption
- [ ] Start a session
- [ ] Disable WiFi/Network briefly
- [ ] **Expected**: Error indicator appears
- [ ] **Expected**: Graceful degradation (no crash)
- [ ] Re-enable network
- [ ] **Expected**: Can retry or recover

**Test**: Microphone Denied
- [ ] Start session but deny microphone permission
- [ ] **Expected**: Clear error: "Failed to access microphone. Please check permissions."
- [ ] Grant permission and retry
- [ ] **Expected**: Works after granting permission

**Test**: Backend Down
- [ ] Stop backend server
- [ ] Try to start session
- [ ] **Expected**: Network error with helpful message
- [ ] **Expected**: UI doesn't crash
- [ ] **Expected**: Can retry after backend restarts

### 6. Memory & Performance

**Test**: Long Session
- [ ] Record a 10+ minute session
- [ ] Monitor browser memory (Chrome Task Manager)
- [ ] **Expected**: Memory stays under 1GB
- [ ] **Expected**: No significant memory leaks
- [ ] **Expected**: No performance degradation over time

**Test**: Multiple Sessions
- [ ] Record 3 consecutive sessions
- [ ] Export each one
- [ ] **Expected**: No accumulated memory issues
- [ ] **Expected**: Each session is independent
- [ ] **Expected**: Audio quality remains consistent

**Test**: Browser Resource Usage
- [ ] Check CPU usage during recording
- [ ] **Expected**: CPU < 50% on modern hardware
- [ ] Check network activity
- [ ] **Expected**: Steady but reasonable bandwidth usage
- [ ] Check audio buffer health
- [ ] **Expected**: No buffer underruns or overruns

### 7. Cross-Browser Testing

**Test**: Chrome/Chromium
- [ ] Run all critical path tests in Chrome
- [ ] **Expected**: All features work correctly
- [ ] **Expected**: No console errors

**Test**: Firefox
- [ ] Run all critical path tests in Firefox
- [ ] **Expected**: All features work correctly
- [ ] **Expected**: Audio playback works
- [ ] **Expected**: Microphone capture works

**Test**: Safari
- [ ] Run all critical path tests in Safari
- [ ] **Expected**: All features work correctly
- [ ] **Expected**: No WebKit-specific issues
- [ ] **Expected**: Microphone permissions work correctly

### 8. Edge Cases

**Test**: Empty Session
- [ ] Start session
- [ ] Immediately end session without speaking
- [ ] **Expected**: Graceful handling
- [ ] **Expected**: No errors
- [ ] **Expected**: Export is disabled or shows empty state

**Test**: Very Long Utterance
- [ ] Speak continuously for 2+ minutes
- [ ] **Expected**: Entire speech is captured
- [ ] **Expected**: Transcript updates progressively
- [ ] **Expected**: No truncation

**Test**: Rapid Session Cycling
- [ ] Start session
- [ ] End immediately
- [ ] Repeat 5 times quickly
- [ ] **Expected**: No resource leaks
- [ ] **Expected**: Each session is independent
- [ ] **Expected**: No accumulated errors

**Test**: Multiple Tabs
- [ ] Open studio in two browser tabs
- [ ] Start session in both
- [ ] **Expected**: Each maintains separate state
- [ ] **Expected**: No interference between tabs

---

## 🔍 Regression Testing

After any code changes, re-run at minimum:
1. ✅ Basic paper fetching
2. ✅ Session start/end cycle
3. ✅ Simple conversation (3-5 turns)
4. ✅ Transcript export
5. ✅ Audio bundle download

---

## 📊 Success Criteria

### Critical (Must Pass)
- ✅ Can fetch papers from Research Hub
- ✅ Can start live session
- ✅ Microphone captures audio
- ✅ AI responds with audio and text
- ✅ Transcripts appear correctly
- ✅ Can end session and save
- ✅ Can export transcript and audio

### Important (Should Pass)
- ✅ No console errors during normal operation
- ✅ Memory usage stays reasonable
- ✅ Turn detection works automatically
- ✅ Error messages are clear and helpful
- ✅ Cleanup happens properly on session end

### Nice to Have
- ✅ Works in all major browsers
- ✅ Handles edge cases gracefully
- ✅ Performance is smooth on older hardware
- ✅ Can handle very long sessions

---

## 🐛 Bug Reporting Template

When reporting issues found during testing:

```markdown
### Bug Description
[Clear description of the issue]

### Steps to Reproduce
1. [First step]
2. [Second step]
3. [...]

### Expected Behavior
[What should happen]

### Actual Behavior
[What actually happened]

### Environment
- Browser: [Chrome/Firefox/Safari + version]
- OS: [macOS/Windows/Linux + version]
- Backend running: [Yes/No]
- Console errors: [Yes/No - copy if yes]

### Screenshots/Logs
[Attach if applicable]

### Severity
[Critical/High/Medium/Low]
```

---

## ✅ Test Report Template

After completing testing:

```markdown
## Test Session Report

**Date**: [Date]
**Tester**: [Name]
**Duration**: [Time spent testing]
**Environment**: [OS, Browser versions]

### Tests Passed: X/Y

### Critical Issues Found: [Number]
[List critical issues]

### Non-Critical Issues: [Number]
[List minor issues]

### Notes:
[Any additional observations]

### Recommendation:
[ ] Ready for deployment
[ ] Needs fixes before deployment
[ ] Blocked by: [issue]
```

