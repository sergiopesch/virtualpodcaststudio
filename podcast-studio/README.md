# Podcast Studio Frontend

Next.js frontend for the Virtual Podcast Studio application. This is the primary application
that handles both the UI and realtime AI conversations.

## 🚀 Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## 🛠️ Tech Stack

- **Next.js 15** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Shadcn/UI** for components
- **Radix UI** for accessible primitives

## 📁 Project Structure

```text
src/
├── app/                    # Next.js App Router
│   ├── api/
│   │   ├── papers/         # Papers API proxy to Python backend
│   │   │   └── fetch-text/ # PDF text extraction for paper context
│   │   └── rt/             # Realtime conversation API routes
│   │       ├── start/      # Start a realtime session
│   │       ├── stop/       # Stop a realtime session
│   │       ├── audio-append/ # Send mic audio chunks
│   │       ├── audio/      # SSE stream of AI audio
│   │       ├── transcripts/ # SSE stream of AI text
│   │       └── user-transcripts/ # SSE stream of user speech
│   ├── studio/             # Audio Studio page
│   ├── video-studio/       # Video Studio page
│   ├── library/            # Library page
│   ├── publisher/          # Publisher page
│   ├── analytics/          # Analytics page
│   ├── globals.css         # Global styles
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Research Hub (home page)
├── components/ui/          # Reusable UI components
├── contexts/               # React contexts (sidebar, API config)
└── lib/
    ├── realtimeSession.ts  # Server-side OpenAI WebSocket manager
    ├── conversationStorage.ts # Conversation serialization
    ├── zip.ts              # ZIP archive utilities
    └── ai/                 # AI client utilities
```

## 🎨 Features

- Dark theme with professional design
- Topic selection with checkboxes (AI, ML, Computer Vision, Robotics)
- Real-time paper fetching from arXiv
- **Realtime AI conversations** via OpenAI Realtime API
- **Paper context pre-fetching** - full paper text loaded before session starts
- **Session controls** - Start, Pause/Resume, End session
- **Mute functionality** - mute microphone during active sessions
- Live transcript display with typing animations
- **Auto-scrolling transcript** - fixed-height Live Feed with internal scrolling
- Audio playback and recording
- Export options (transcript, audio bundle)
- **Fully responsive design** - mobile to 2xl screens
- Error handling and loading states

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint (`--max-warnings=0` supported)
- `npm run format` - Format code with Prettier

## 🎙️ Realtime Architecture

The realtime conversation system is entirely managed by this Next.js application:

1. **Paper Context** (`/api/papers/fetch-text`)
   - Pre-fetches PDF full text from arXiv
   - Provides rich context to the AI before conversation starts

2. **Session Management** (`/api/rt/start`, `/api/rt/stop`)
   - Creates/destroys realtime sessions
   - Manages OpenAI WebSocket connections server-side

3. **Audio Input** (`/api/rt/audio-append`)
   - Receives base64 PCM16 audio chunks from the browser
   - Forwards to OpenAI via WebSocket
   - Respects mute state

4. **Audio/Transcript Output** (SSE streams)
   - `/api/rt/audio` - Streams AI audio as base64 PCM16
   - `/api/rt/transcripts` - Streams AI transcript deltas
   - `/api/rt/user-transcripts` - Streams user speech detection and transcription

The `RTManager` class in `src/lib/realtimeSession.ts` maintains the WebSocket connection to
OpenAI and emits events that the SSE routes listen to.

## 🎛️ Audio Studio Controls

| Control | Description |
|---------|-------------|
| **Start Session** | Initiates connection with OpenAI Realtime API |
| **Pause Session** | Temporarily stops audio I/O without ending session |
| **Resume Session** | Continues a paused session |
| **End Session** | Stops session and saves conversation |
| **Mute** | Toggles microphone on/off during active session |

## 📱 Responsive Layout

The Audio Studio uses a 12-column grid system:

| Screen Size | Paper/Controls | Live Feed |
|-------------|----------------|-----------|
| Mobile (< 1024px) | Full width (stacked) | Full width |
| Large (1024px+) | 3 columns | 9 columns |
| 2XL (1536px+) | 2 columns | 10 columns |

The Live Feed has a fixed viewport height with internal scrolling, ensuring the latest
message is always visible without scrolling the entire page.

## 🔑 Environment Variables

Create `.env.local` with:

```bash
OPENAI_API_KEY=sk-...          # Required for realtime conversations
# Optional:
OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview-2024-10-01
OPENAI_REALTIME_VOICE=alloy
BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

## 🧪 Testing Checklist

1. Start the dev server: `npm run dev`
2. Visit `/` (Research Hub) and select a paper
3. Navigate to `/studio` (Audio Studio)
4. Wait for "Context Ready" indicator (paper text loaded)
5. Click "Start Session" and grant microphone permission
6. Speak and verify:
   - Your audio is captured (mic indicator active)
   - AI responds with audio and text
   - Transcript appears with typing animation
   - Auto-scroll keeps latest message visible
7. Test Pause/Resume - audio should stop/resume cleanly
8. Test Mute - your voice should not appear when muted
9. Click "End Session" and verify cleanup
10. Test export features (transcript, audio bundle)
11. Test on mobile and desktop for responsive layout
