# 🔧 Quick Fix for OpenAI Session Error

## Issue
The error `Unknown parameter: 'session.input_audio_sample_rate'` suggests an outdated or cached session configuration.

## Solution Steps

### 1. Add OpenAI API Key
```bash
echo "OPENAI_API_KEY=your_openai_api_key_here" > backend/.env
```

### 2. Test OpenAI Connection
```bash
cd backend
source venv/bin/activate
python ../test_openai_session.py
```

### 3. Start Backend (Clean)
```bash
# Kill any existing backend processes
pkill -f "uvicorn main:app"

# Start fresh backend
cd backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Clear Frontend Cache
```bash
# In new terminal
cd podcast-studio
rm -rf .next
npm run dev
```

## What I Fixed

✅ **Removed unsupported parameters** from session config
✅ **Simplified session configuration** to minimal required fields  
✅ **Added debug logging** to see exact config being sent
✅ **Updated connection handling** with proper error checking

## Session Configuration Now Uses
```json
{
  "modalities": ["text", "audio"],
  "instructions": "...",
  "voice": "alloy", 
  "input_audio_format": "pcm16",
  "output_audio_format": "pcm16",
  "turn_detection": {
    "type": "server_vad",
    "threshold": 0.5,
    "prefix_padding_ms": 300,
    "silence_duration_ms": 500
  },
  "temperature": 0.8
}
```

## If Error Persists

The error might be cached from a previous session. Try:

1. **Clear browser cache** and restart browser
2. **Check OpenAI API key** has Realtime API access
3. **Verify account credits** are available
4. **Check logs** in backend terminal for exact error details

The session configuration is now minimal and should work with the current OpenAI Realtime API.
