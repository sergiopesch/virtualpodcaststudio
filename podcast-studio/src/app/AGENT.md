# Research Hub Page – Agent Guide

## Overview

The Research Hub lives in [`src/app/page.tsx`](./page.tsx) and serves as the landing page of the Virtual Podcast Studio. It combines topic selection, arXiv paper retrieval, and navigation hand-offs to the Audio Studio. The component is a client-side React page (`"use client"`) that orchestrates UI chrome from the shared layout (`Sidebar`, `Header`) with data fetched through the `/api/papers` Next.js API proxy.

## Page Structure

```
Research Hub layout
├─ Sidebar / Header (shared layout controls)
├─ Stats Overview cards (animated KPIs)
├─ Topic Selection grid (toggleable research areas)
├─ Action Card (find + clear buttons, selection summary)
└─ Paper List (scrollable results / empty & error states)
```

- **Sidebar/Header**: Provided by `@/components/layout`. `useSidebar()` supplies collapse state; keep props aligned if APIs change.
- **Stats Overview**: Driven by the `stats` constant. Animation delay is controlled via inline `style`—if you add cards, keep unique `key`s and incremental delays.
- **Topic Selection**: Buttons generated from the `topics` array. Classes rely on the shared `cn` helper for conditional Tailwind styling and on lucide-react icons.
- **Action Card**: Houses the "Find Papers" and "Clear" buttons. Primary button uses the custom `variant="gradient"`; ensure new variants exist in the button component before referencing them.
- **Paper List**: Wrapped in a `ScrollArea` with `h-96` height. Includes three states: error, results, and empty placeholder. Result cards route to `/studio` via `Link`.

## Data & State Flow

- `selectedTopics`: Array of topic IDs; stored as an ordered array derived from a `Set` to preserve deterministic ordering.
- `papers`: Holds `PaperCardData` objects (enriched arXiv metadata).
- `loading` / `error`: Booleans & strings controlling UI feedback.
- `abortControllerRef`: Ensures only the latest `/api/papers` request resolves; remember to abort previous fetches when introducing new network calls.

### `transformPapers`

- Deduplicates by `paper.id` using a `Set`.
- Splits the `authors` comma list into `primaryAuthor` and `hasAdditionalAuthors` flags.
- Converts `published` to `toLocaleDateString()` when valid; otherwise preserves the raw string.
- When modifying backend payloads, update this function and the backend serializer together so keys stay in sync.

### Fetch Lifecycle (`handleFetchPapers`)

1. Bail out if no topics are selected.
2. Abort any inflight request and register a fresh `AbortController`.
3. POST to `/api/papers` with `cache: "no-store"` to avoid stale results.
4. On success, call `transformPapers`; on failure, set `error` and log the exception.
5. Clean up the controller and `loading` state only if it matches the latest request.

Keep this pattern intact when adding new async operations so race conditions remain handled.

## Audio Studio Handoff

- `handleStartAudioStudio` persists the clicked `PaperCardData` into `sessionStorage` using the `vps:selectedPaper` key before routing to `/studio`.
- Extend that stored payload whenever you add new paper fields that the Audio Studio needs (mirror any schema updates in `studio/page.tsx`).
- Storage writes are wrapped in `try/catch`; surface meaningful errors in the console if persistence fails so the Audio Studio can warn users when no paper is available.

## Styling Conventions

- Tailwind CSS with gradient backgrounds (`gradient-primary`, `shadow-glow`) defined in `globals.css`. Reuse existing utility classes instead of inlining custom CSS.
- Animation utilities (`animate-fade-in`, `animate-slide-up`, `animate-scale-in`) expect matching keyframes in global styles—verify before introducing new names.
- Maintain accessibility: use `aria-pressed` for toggle buttons and ensure icons include text labels.

## Extension Guidelines

- **New Topics**: Add objects to `topics` with `id`, `label`, `icon`, and color tokens. Update backend/topic validation if you introduce unfamiliar arXiv categories.
- **Additional Filters**: Compose new state with `useState`/`useMemo`, but reset them inside `handleClearSelection` to keep the "Clear" action predictable.
- **Paper Card Actions**: Wrap new CTAs in `<Button asChild>` for consistent styling and add `rel="noopener noreferrer"` to external links.
- **Search Field**: `Header` currently logs queries; if you wire it up, debounce requests and share the existing abort controller.

## Testing Checklist

- Trigger fetch with multiple topics and confirm deduplication (no repeated cards).
- Abort scenario: rapidly click "Find Papers" twice and verify the UI does not flicker outdated results.
- Empty + error states: clear selection and simulate a failed fetch (e.g., temporarily disconnect backend) to ensure messaging appears.
- Run `npm run lint` from `podcast-studio/` after structural changes touching hooks or dependencies.

Following this guide will help future agents modify the Research Hub while preserving responsive layout, fetch hygiene, and visual polish.
