# 🚀 Virtual Podcast Studio - Complete Setup Guide

## Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** (20 recommended) - [Download here](https://nodejs.org/)
- **Python 3.8+** - [Download here](https://www.python.org/downloads/)
- **OpenAI API key** with Realtime API access - [Get one here](https://platform.openai.com/api-keys)
- **Git** (optional, for cloning) - [Download here](https://git-scm.com/)

## Quick Start (5 Minutes)

### Step 1: Configure Environment Variables

#### Backend Configuration

1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```

2. Create a `.env` file:
   ```bash
   # On Mac/Linux:
   touch .env
   
   # On Windows:
   type nul > .env
   ```

3. Open `.env` in your text editor and add:
   ```bash
   OPENAI_API_KEY=sk-your-actual-api-key-here
   ```

   **Important**: Replace `sk-your-actual-api-key-here` with your real OpenAI API key.

#### Frontend Configuration

1. Navigate to the `podcast-studio` directory:
   ```bash
   cd ../podcast-studio
   ```

2. Create a `.env.local` file:
   ```bash
   # On Mac/Linux:
   touch .env.local
   
   # On Windows:
   type nul > .env.local
   ```

3. Open `.env.local` and add:
   ```bash
   OPENAI_API_KEY=sk-your-actual-api-key-here
   ```

   **Note**: This is a fallback key for server-side Next.js routes. You can use the same key as the backend.

### Step 2: Install Dependencies

#### Backend Dependencies

```bash
cd backend
python -m venv venv

# Activate virtual environment:
# On Mac/Linux:
source venv/bin/activate

# On Windows:
venv\Scripts\activate

# Install packages:
pip install -r requirements.txt
```

#### Frontend Dependencies

```bash
cd ../podcast-studio
npm install
```

### Step 3: Verify Setup

Run the health check from the repo root:

```bash
cd ..
python quick_health_check.py
```

You should see:
```
✅ OPENAI_API_KEY found in backend/.env
✅ Backend is running
   Status: healthy
```

If you see any errors, review the troubleshooting section below.

### Step 4: Start the Application

You need two terminal windows/tabs:

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate  # Windows: venv\Scripts\activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 - Frontend:**
```bash
cd podcast-studio
npm run dev
```

### Step 5: Access the Application

Open your browser and navigate to:
- **Research Hub**: http://localhost:3000
- **Audio Studio**: http://localhost:3000/studio
- **Video Studio**: http://localhost:3000/video-studio

---

## 🎯 Using the Audio Studio

### Initial Setup

1. **Go to the Research Hub** (http://localhost:3000)
   - Select topics you're interested in (e.g., cs.AI, cs.ML)
   - Click "Fetch Papers"
   - Browse the results and click "Start Audio Studio" on any paper

2. **Configure API Settings** (in Audio Studio)
   - Click the settings icon in the sidebar
   - Select your provider (OpenAI)
   - Optionally enter your API key (if not using server-side fallback)
   - Choose your preferred model

### Recording a Podcast

1. **Start Live Session**
   - Click "Start Live Session" button
   - Allow microphone access when prompted
   - Wait for the connection to establish

2. **Have a Conversation**
   - Speak naturally into your microphone
   - The AI will respond with audio and text
   - Watch the live transcript appear on screen
   - Turn detection is automatic - just pause when done speaking

3. **End Session**
   - Click "End Session" when finished
   - Your conversation is automatically saved

### Exporting Your Work

After recording, you can:
- **Export Transcript**: Download a text file of the conversation
- **Download Audio Bundle**: Get a ZIP with separate audio tracks and metadata
- **Send to Video Studio**: Continue editing with visual tools

---

## 🔧 Troubleshooting

### Backend Issues

#### "OPENAI_API_KEY not properly set"

**Solution**:
1. Check that `backend/.env` exists
2. Open the file and verify your API key is present and starts with `sk-`
3. Ensure there are no extra spaces or quotes around the key
4. Restart the backend server

#### "Backend is not running"

**Solution**:
1. Make sure you started uvicorn: `uvicorn main:app --host 0.0.0.0 --port 8000 --reload`
2. Check for errors in the terminal
3. Verify port 8000 is not already in use:
   ```bash
   # Mac/Linux:
   lsof -i :8000
   
   # Windows:
   netstat -ano | findstr :8000
   ```
4. Try a different port if needed: `uvicorn main:app --port 8001 --reload`

#### "Module not found" errors

**Solution**:
1. Ensure virtual environment is activated (you should see `(venv)` in your prompt)
2. Reinstall dependencies: `pip install -r requirements.txt`
3. Check Python version: `python --version` (should be 3.8+)

### Frontend Issues

#### "Failed to start realtime session"

**Possible causes**:
- **Missing API key**: Check both backend/.env and podcast-studio/.env.local
- **Invalid API key**: Verify your key is correct and has Realtime API access
- **Backend not running**: Ensure uvicorn is running on port 8000
- **CORS issues**: Check backend logs for CORS errors

**Solution**:
1. Verify backend is running: `curl http://localhost:8000/health`
2. Check browser console for detailed error messages
3. Verify API key in Settings panel
4. Try using a different browser

#### "Failed to access microphone"

**Solution**:
1. Grant microphone permissions when prompted
2. Check browser settings:
   - Chrome: Settings → Privacy and Security → Site Settings → Microphone
   - Safari: Safari → Preferences → Websites → Microphone
3. Ensure no other application is using the microphone
4. Try refreshing the page and allowing permissions again

#### "No audio or transcript appearing"

**Solution**:
1. Check the browser console for errors
2. Verify the Network tab shows connections to:
   - `/api/rt/audio` (SSE)
   - `/api/rt/transcripts` (SSE)
   - `/api/rt/user-transcripts` (SSE)
3. Ensure you're speaking clearly and loudly enough
4. Check that your microphone is working (test in system settings)

#### Build or dependency errors

**Solution**:
1. Delete `node_modules` and reinstall:
   ```bash
   rm -rf node_modules
   npm install
   ```
2. Clear Next.js cache:
   ```bash
   rm -rf .next
   npm run dev
   ```
3. Check Node.js version: `node --version` (should be 18+)

### Performance Issues

#### High memory usage

The application includes memory limits to prevent exhaustion, but long sessions may still consume significant memory.

**Solution**:
1. Keep recording sessions under 30 minutes
2. Export and download your work periodically
3. Refresh the page between long sessions
4. Close other browser tabs to free up memory

#### Audio glitches or stuttering

**Solution**:
1. Close unnecessary applications
2. Check CPU usage (Activity Monitor on Mac, Task Manager on Windows)
3. Try reducing browser tab count
4. Ensure stable internet connection
5. Consider using Chrome for best performance

---

## 🔐 Security Best Practices

1. **Never commit `.env` files to version control**
   - These files are already in `.gitignore`
   - Always use `.env.example` templates for sharing

2. **Rotate API keys regularly**
   - Generate new keys monthly from OpenAI dashboard
   - Revoke old keys after rotation

3. **Use environment-specific keys**
   - Different keys for development and production
   - Monitor usage in OpenAI dashboard

4. **Clear sensitive data**
   - API keys are stored in memory only (not localStorage)
   - Clear browser cache regularly for added security

---

## 📚 Additional Resources

- [OpenAI Realtime API Documentation](https://platform.openai.com/docs/guides/realtime)
- [Next.js 15 Documentation](https://nextjs.org/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Project README](./README.md)
- [Security Documentation](./SECURITY.md)

---

## 🆘 Still Having Issues?

If you're still experiencing problems after following this guide:

1. Check the browser console (F12) for detailed error messages
2. Review the backend logs in the terminal where uvicorn is running
3. Run the health check script again: `python quick_health_check.py`
4. Try the application in incognito/private mode to rule out extension conflicts
5. Review the [REVIEW.md](./REVIEW.md) file for known issues

---

## 🎉 Success Checklist

- ✅ Backend .env configured with valid OPENAI_API_KEY
- ✅ Frontend .env.local configured (optional but recommended)
- ✅ Dependencies installed (backend and frontend)
- ✅ Health check passes
- ✅ Backend running on port 8000
- ✅ Frontend running on port 3000
- ✅ Can access http://localhost:3000
- ✅ Can start a live session in the Audio Studio
- ✅ Microphone permissions granted
- ✅ Can see live transcripts and hear AI responses

**Congratulations! You're ready to create amazing AI-powered podcasts! 🎙️**

