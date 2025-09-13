# 🎙️ Virtual Podcast Studio - Quick Setup Guide

> **Note**: For comprehensive setup instructions, see the main [README.md](README.md)

## 🚀 Quick Start (5 minutes)

### 1. Prerequisites
- Node.js 18+ and Python 3.8+
- OpenAI API key with Realtime API access

### 2. Environment Setup

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
echo "OPENAI_API_KEY=your_key_here" > .env
```

**Frontend:**
```bash
cd podcast-studio
npm install
```

### 3. Start Services

**Terminal 1:**
```bash
cd backend && source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2:**
```bash
cd podcast-studio
npm run dev
```

### 4. Access Application
Visit: `http://localhost:3000/studio`

## ✅ Verification Checklist

- [ ] Backend shows "✅ OpenAI session ready successfully"
- [ ] Frontend loads without console errors
- [ ] WebSocket connects (status shows "READY")
- [ ] Microphone permission granted
- [ ] Voice recording button works
- [ ] AI responds to voice/text input

## 🐛 Quick Fixes

**"OpenAI API key not configured"**
```bash
echo "OPENAI_API_KEY=your_actual_key" > backend/.env
```

**"Port 8000 already in use"**
```bash
pkill -f "uvicorn main:app"
# Then restart backend
```

**"WebSocket connection failed"**
- Check backend is running on port 8000
- Verify CORS settings
- Check browser console for errors

## 📚 Additional Resources

- [Voice Recording Setup](VOICE_RECORDING_SETUP.md) - Audio configuration details
- [Debug Guide](debug_audio_studio.md) - Step-by-step troubleshooting
- [Realtime Implementation](realtime_ws_track_b_implementation.md) - Technical architecture
