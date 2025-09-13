# 🎤 Voice Recording Setup Guide

> **Note**: For basic setup, see [SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md)

## 🎙️ Audio Configuration

### Microphone Requirements
- **Chrome/Edge**: Recommended for best WebRTC support
- **Firefox**: Supported but may have audio processing differences
- **Safari**: Limited WebRTC support, use Chrome/Edge instead

### Browser Permissions
1. **Allow Microphone Access**: Click "Allow" when prompted
2. **Check Permissions**: Go to browser settings → Privacy → Microphone
3. **Test Audio**: Use browser's built-in audio test tools

### Audio Format
- **Sample Rate**: 16kHz (automatically converted)
- **Format**: PCM16 mono
- **Chunk Size**: 1280 bytes (~40ms of audio)
- **Bitrate**: 16-bit depth

## 🔧 Audio Troubleshooting

### No Audio Input
**Symptoms**: No audio chunks in console logs
```javascript
// Check audio context state
console.log(audio.audioContext.state); // Should be "running"
```

**Solutions**:
- Refresh page and allow microphone permissions
- Check browser audio settings
- Try different browser (Chrome recommended)
- Verify microphone is working in other apps

### Audio Quality Issues
**Symptoms**: Distorted or choppy audio
```javascript
// Check sample rate
console.log(audio.audioContext.sampleRate); // Should be 48000 or 44100
```

**Solutions**:
- Close other audio applications
- Check system audio drivers
- Reduce browser tab count
- Try incognito mode

### WebSocket Audio Streaming
**Expected Flow**:
1. Audio captured → PCM16 conversion
2. Base64 encoding → WebSocket transmission
3. OpenAI processing → Transcription + Response
4. AI audio → Base64 decoding → Browser playback

**Debug Commands**:
```javascript
// Check WebSocket connection
console.log(websocket.readyState); // Should be 1 (OPEN)

// Monitor audio chunks
console.log("Audio chunk size:", audioChunk.length); // Should be ~1280
```

## 🎯 Voice Activity Detection

### Server-Side VAD
- **Threshold**: 0.5 (configurable)
- **Padding**: 300ms prefix, 500ms silence
- **Detection**: Automatic speech start/stop

### Manual Control
If VAD isn't working properly:
```javascript
// Manual turn commit (if needed)
websocket.send(JSON.stringify({
  type: "manual_commit"
}));
```

## 🔊 Audio Playback

### Browser Audio Element
- **Format**: WAV streaming
- **Auto-play**: Enabled (may require user interaction)
- **Controls**: Built-in browser audio controls

### Audio Issues
**No AI Voice Response**:
- Check browser audio settings
- Verify WebSocket is receiving audio data
- Check console for audio playback errors

**Delayed Audio**:
- Normal for first response (~2-3 seconds)
- Subsequent responses should be faster
- Check network latency

## 🧪 Testing Audio Pipeline

### Step 1: Basic Audio Test
```bash
# Test microphone in browser
# Go to: https://www.onlinemictest.com/
```

### Step 2: Application Test
1. Open DevTools → Console
2. Start voice recording
3. Speak for 2-3 seconds
4. Check for these logs:
   ```javascript
   🎵 AudioContext created, actual sample rate: 48000
   🎤 Microphone access granted
   🔊 Audio chunk processed, length: 1280
   📤 Sending PCM16 audio data to WebSocket
   ```

### Step 3: Backend Verification
Backend terminal should show:
```bash
🎤 Processing audio chunk from client
input_audio_buffer.append sent to OpenAI
🎤 User started speaking
🔇 User stopped speaking
📝 Live transcription update: [your words]
```

## 🎛️ Advanced Configuration

### Custom Audio Settings
```javascript
// Modify audio processing (if needed)
const audioConfig = {
  sampleRate: 16000,
  channelCount: 1,
  bufferSize: 1280
};
```

### VAD Tuning
```python
# Backend configuration
turn_detection = {
    "type": "server_vad",
    "threshold": 0.5,        # Lower = more sensitive
    "prefix_padding_ms": 300,
    "silence_duration_ms": 500
}
```

## 📊 Performance Monitoring

### Audio Metrics
- **Latency**: ~200-500ms end-to-end
- **Throughput**: ~25 chunks/second
- **Quality**: 16kHz PCM16 mono

### Optimization Tips
- Use Chrome/Edge for best performance
- Close unnecessary browser tabs
- Ensure stable internet connection
- Use wired headphones to avoid feedback

## 🆘 Emergency Fixes

**Complete Audio Reset**:
1. Refresh browser page
2. Restart backend server
3. Clear browser cache
4. Try incognito mode

**Fallback to Text Mode**:
If audio completely fails, you can still use text input for AI conversations.
