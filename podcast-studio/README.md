# Podcast Studio Frontend

Next.js frontend for the Virtual Podcast Studio application.

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
├── app/                 # Next.js App Router
│   ├── api/papers/      # API routes
│   ├── globals.css      # Global styles
│   ├── layout.tsx       # Root layout
│   └── page.tsx         # Home page
├── components/ui/       # Reusable UI components
└── lib/                 # Utility functions
```

## 🎨 Features

- Dark theme with professional design
- Topic selection with checkboxes (AI, ML, Computer Vision, Robotics)
- Real-time paper fetching from arXiv
- Responsive design for all devices
- Error handling and loading states

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint (`--max-warnings=0` supported)
- `npm run format` - Format code with Prettier
- *(planned)* `npm run test` - Placeholder until automated tests are added

## 🧩 Realtime Adapter

- Realtime conversations are routed through `src/lib/ai/realtimeAdapter.ts`.
- Providers register a `RealtimeAdapter` implementation; OpenAI is the default.
- `/api/rt/start` and `/api/rt/webrtc` use the adapter to exchange SDP and bootstrap sessions.
- To add a provider, register it in `providerRegistry` and supply a matching adapter.

## 🧪 Testing Roadmap

- Automated tests are not yet defined; run `npm run lint` for static analysis.
- Planned: add adapter-level tests under `src/lib/ai/__tests__` (see TODO).
