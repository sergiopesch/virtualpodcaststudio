# Frontend Agent Guide

## Mission & Stack
This Next.js 15 App Router project (TypeScript + Tailwind 4) powers the complete Virtual
Podcast Studio workflow: researching papers, conducting realtime conversations with OpenAI, and
simulating post-production tooling. Styling relies on utilities defined in
[`src/app/globals.css`](./src/app/globals.css) together with shadcn-inspired primitives in
`src/components/ui`.

```
podcast-studio/
├── src/
│   ├── app/               # App Router pages + API routes
│   ├── components/        # Layout chrome, shadcn-derived UI primitives
│   ├── contexts/          # Sidebar + API provider state
│   ├── hooks/             # Legacy websocket client (fallback)
│   └── lib/               # Realtime session manager + conversation storage
├── package.json           # Next.js 15, React 19, Tailwind 4
└── AGENT.md               # This guide
```

## Application Flow
1. **Layout wrappers** – `src/app/layout.tsx` wraps all pages with `SidebarProvider` and
   `ApiConfigProvider` so layout collapse state and API credentials are available everywhere.
2. **Research Hub (`src/app/page.tsx`)** – Client component that lets users toggle topics,
   fetches papers through `/api/papers`, and persists the selected paper to
   `sessionStorage` (`vps:selectedPaper`) before routing to the Audio Studio.
3. **Audio Studio (`src/app/studio/page.tsx`)** – Restores the stored paper, validates API
   provider settings, bootstraps realtime sessions via `/api/rt/start`, negotiates WebRTC with
   `/api/rt/webrtc`, streams microphone chunks to `/api/rt/audio-append`/`audio-commit`, listens
   to SSE feeds (`/audio`, `/transcripts`, `/user-transcripts`), and exposes export/handoff
   controls.
4. **Video Studio / Library / Publisher / Analytics** – Rich dashboard components that consume
   conversations saved by the Audio Studio through `conversationStorage.ts`, letting users review
   transcripts, timelines, and analytics.
5. **API routes** – App Router endpoints under `src/app/api/` proxy browser actions to the
   backend (`/api/papers`) and to the server-side realtime session manager (`/api/rt/*`). They all
   run on the Node.js runtime.

## Key Modules
- **Layout chrome** – `src/components/layout/sidebar.tsx`, `header.tsx`, `user-menu.tsx` render
  navigation, status badges, search, and workspace settings. They expect the layout providers to
  be present.
- **UI primitives** – `src/components/ui` contains buttons, cards, sheets, dropdowns, etc. Follow
  their AGENT for styling conventions.
- **Contexts** – `SidebarProvider` manages the collapse state; `ApiConfigProvider` stores the
  active provider, volatile API keys, and model overrides with localStorage hydration.
- **Realtime session manager** – `src/lib/realtimeSession.ts` maintains OpenAI WebSocket
  connections, normalises paper context, and emits events consumed by the `/api/rt/*` routes and
  SSE streams.
- **Conversation storage** – `src/lib/conversationStorage.ts` encodes PCM16 audio into WAV/base64
  bundles and persists the latest conversation for the video tooling.

## Implementation Guidelines
- **Stay aligned with the backend** – Paper schemas and validation are shared with
  `backend/main.py`. Update the Research Hub, `/api/papers`, and Audio Studio handoff together.
- **Realtime lifecycle** – Always call `/api/rt/start` before uploading audio or sending text.
  When emitting new events from `realtimeSession.ts`, update the Audio Studio data-channel/SSE
  handlers and the API routes that forward them.
- **Session storage contracts** – `vps:selectedPaper` and the conversation payload saved via
  `conversationStorage.ts` are consumed across pages. Keep changes backwards compatible and guard
  JSON parsing failures.
- **Styling** – Prefer Tailwind utilities and the gradient/glass tokens from `globals.css`. Add
  utilities there instead of hard-coding colours.
- **Client vs server boundaries** – API routes and `realtimeSession.ts` must stay Node-only;
  avoid importing client components or browser APIs in those modules.

## Environment Variables
Create `.env.local` with any required server-side credentials:
- `OPENAI_API_KEY` – fallback key used by realtime API routes when the user has not supplied one.
- `OPENAI_REALTIME_MODEL`, `OPENAI_REALTIME_VOICE` – optional overrides for session defaults.
- `BACKEND_URL`, `NEXT_PUBLIC_BACKEND_URL` – override the FastAPI base URL when not running on
  `http://localhost:8000`.

Secrets are never written to persistent storage on the client—the workspace settings sheet keeps
API keys in memory only.

## Testing
- `npm run lint` – ESLint 9 (Next.js flat config).
- `npm run build` – Validate the production bundle when modifying App Router pages or API routes.
- Manual checks:
  - Fetch multiple topics on the Research Hub and confirm deduped cards render.
  - Start an Audio Studio session, speak into the microphone, verify transcript/audio SSE streams,
    and test export/handoff actions.
  - Open the workspace settings sheet to ensure provider/key changes persist via context.
