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

## 📁 Project Structure

```text
src/
├── app/                    # Next.js App Router
│   ├── api/
│   │   ├── papers/         # Papers API proxy to Python backend
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
    └── ai/                 # AI client utilities
```

## 🎨 Features

- Dark theme with professional design
- Topic selection with checkboxes (AI, ML, Computer Vision, Robotics)
- Real-time paper fetching from arXiv
- **Realtime AI conversations** via OpenAI Realtime API
- Live transcript display with typing animations
- Audio playback and recording
- Export options (transcript, audio bundle)
- Responsive design for all devices
- Error handling and loading states

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint (`--max-warnings=0` supported)
- `npm run format` - Format code with Prettier

## 🎙️ Realtime Architecture

The realtime conversation system is entirely managed by this Next.js application:

1. **Session Management** (`/api/rt/start`, `/api/rt/stop`)
   - Creates/destroys realtime sessions
   - Manages OpenAI WebSocket connections server-side

2. **Audio Input** (`/api/rt/audio-append`)
   - Receives base64 PCM16 audio chunks from the browser
   - Forwards to OpenAI via WebSocket

3. **Audio/Transcript Output** (SSE streams)
   - `/api/rt/audio` - Streams AI audio as base64 PCM16
   - `/api/rt/transcripts` - Streams AI transcript deltas
   - `/api/rt/user-transcripts` - Streams user speech detection and transcription

The `RTManager` class in `src/lib/realtimeSession.ts` maintains the WebSocket connection to
OpenAI and emits events that the SSE routes listen to.

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
4. Click "Start Live Session" and grant microphone permission
5. Speak and verify:
   - Your audio is captured (mic indicator active)
   - AI responds with audio and text
   - Transcript appears with typing animation
6. Click "End Session" and verify cleanup
7. Test export features (transcript, audio bundle)
