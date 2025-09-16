# Frontend Agent Guide

## Mission & Stack
The frontend is a Next.js 15 App Router project written in TypeScript. It powers the full
"virtual podcast studio" experience: research discovery, realtime audio recording, and
post-production dashboards. Styling leans on Tailwind CSS 4 with custom gradient/glass
utilities defined in [`src/app/globals.css`](./src/app/globals.css).

```
podcast-studio/
├── src/
│   ├── app/               # App Router pages + API routes
│   ├── components/        # Layout chrome, shadcn-based UI primitives
│   ├── contexts/          # React context providers for sidebar + API keys
│   ├── hooks/             # Legacy websocket hook (fallback path)
│   └── lib/               # Realtime session manager + shared utilities
├── package.json           # Next.js 15, React 19, Tailwind 4
└── AGENT.md               # This guide
```

## High-Level Flow
1. **Research Hub (`src/app/page.tsx`)** – Users pick arXiv categories, call the Next.js
   `/api/papers` route, and review normalized results. Choosing "Start Audio Studio"
   persists the selected paper into `sessionStorage` (`vps:selectedPaper`).
2. **Audio Studio (`src/app/studio/page.tsx`)** – Restores the stored paper, ensures a
   realtime session via `/api/rt/start`, negotiates WebRTC with `/api/rt/webrtc`, and
   streams PCM16 microphone chunks through `/api/rt/audio-append`. Server-Sent Events from
   `/api/rt/audio`, `/api/rt/transcripts`, and `/api/rt/user-transcripts` render live audio
   and captions.
3. **Video Studio / Library / Publisher pages** – Rich mock dashboards that share layout
   chrome and highlight the post-production pipeline.

Backend communication happens exclusively through App Router API routes. They either proxy
requests to FastAPI (`/api/papers`) or interact with the shared `rtSessionManager`
(`src/lib/realtimeSession.ts`) for realtime sessions.

## Key Modules
- **Layout chrome** – `src/components/layout/sidebar.tsx`, `header.tsx`, and
  `user-menu.tsx` render navigation, search, status, and workspace settings. They expect to
  be wrapped in both `SidebarProvider` and `ApiConfigProvider` (see `src/app/layout.tsx`).
- **UI primitives** – `src/components/ui` hosts shadcn-derived components (Button, Card,
  Checkbox, ScrollArea, DropdownMenu, Sheet, Tabs). Follow their AGENT for styling rules.
- **Contexts** – `SidebarProvider` manages collapse state; `ApiConfigProvider` persists
  user-supplied API keys and active provider to `localStorage`.
- **Realtime session manager** – `src/lib/realtimeSession.ts` implements a server-side
  singleton that talks to OpenAI's Realtime WebSocket API, emits transcript/audio events,
  and cleans up idle sessions. API routes under `src/app/api/rt` are thin wrappers around
  it.

## Adding or Modifying Features
- **Stay in sync with the backend** – Any schema change to `Paper` or paper fetching must be
  mirrored in both `/api/papers` (Next.js) and FastAPI (`backend/main.py`). `transformPapers`
  in `src/app/page.tsx` and the Audio Studio's `SelectedPaper` interface expect the same
  shape.
- **Realtime flows** – Always start sessions (`/api/rt/start`) before posting audio/text.
  When extending event types, update both the Audio Studio handlers and the session manager
  event emitters. The WebSocket fallback (`src/hooks/useRealtimeConversation.ts`) still
  expects the legacy FastAPI events—keep it compiling even if unused by default.
- **Context usage** – Components that read `useSidebar` or `useApiConfig` must live under
  the matching providers. If you add new providers, register them in `src/app/layout.tsx` so
  all pages share the same context tree.
- **Styling** – Prefer Tailwind utilities or the gradient/glass tokens defined in
  `globals.css`. Avoid inline colors that drift from the design language; add utilities to
  `globals.css` if needed.
- **State hygiene** – Use `AbortController` when introducing new network requests on the
  Research Hub to match the existing race-cancellation logic. Remember to clear additional
  state inside `handleClearSelection` when you append new filters.
- **Session storage contracts** – Keep the `vps:selectedPaper` payload backwards compatible
  (Audio Studio will surface errors if parsing fails). When expanding its schema, update the
  read/write logic in both pages simultaneously.

## Environment Variables
Create `.env.local` with:
- `OPENAI_API_KEY` – used by server-side API routes if the user has not supplied a key.
- `OPENAI_REALTIME_MODEL`, `OPENAI_REALTIME_VOICE` – optional overrides for WebRTC
  sessions.
- `BACKEND_URL` / `NEXT_PUBLIC_BACKEND_URL` – override FastAPI base URL when not running on
  `http://localhost:8000`.

Do **not** expose secrets on the client. The API routes accept a user-provided key from the
Settings sheet (`ApiConfigProvider`) and fall back to server env vars only on the server.

## Testing Checklist
- `npm run lint` – ESLint 9 (fails currently due to known upstream issues; still run it and
  note failures when filing PRs).
- `npm run build` – Validate Turbopack builds for production when changing App Router or
  API code.
- Manual:
  - Fetch papers with several topics and verify deduped cards.
  - Start the Audio Studio, confirm session status via `/api/rt/status`, and inspect SSE
    streams in browser dev tools.
  - Exercise the workspace Settings sheet to ensure API key persistence works.
