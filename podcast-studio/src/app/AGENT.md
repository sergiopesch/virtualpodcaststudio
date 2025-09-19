# Research Hub Page – Agent Guide

## Overview
[`src/app/page.tsx`](./page.tsx) is the landing page for the Research Hub. It is a client
component that renders within the shared layout (Sidebar + Header) and manages the full
lifecycle for selecting arXiv topics, fetching papers, and transferring the chosen paper to the
Audio Studio via `sessionStorage`.

## Page Anatomy
```
<Sidebar> (from layout context)
<Header>
└─ main content
   ├─ Research Topics card (toggle buttons)
   ├─ Action card (Find / Clear buttons + selection summary)
   └─ Research Papers card (scrollable results, empty + error states)
```
- Topics are defined in a local `topics` array (currently AI, ML, Computer Vision, Robotics).
  Icons come from `lucide-react`; styling uses the shared `cn()` helper for Tailwind classes.
- Paper results render inside a `ScrollArea` with CTA buttons for “Start Audio Studio” and
  “Read Paper”.

## State & Derived Data
- `selectedTopics` – array of topic IDs. A `Set` derived via `useMemo` keeps toggles stable and
  preserves ordering when converting back to an array.
- `papers` – array of `PaperCardData` returned by `transformPapers`.
- `loading`, `error` – control button states and empty/error UI.
- `abortControllerRef` – ensures only the most recent `/api/papers` request resolves.

### `transformPapers`
- Deduplicates by `paper.id` using a `Set`.
- Splits `authors` to compute `primaryAuthor` and `hasAdditionalAuthors` flags.
- Converts `published` to a locale date string when possible.
- Extend this function when the backend payload changes so both the card view and Audio Studio
  receive the same shape.

### Fetch Lifecycle (`handleFetchPapers`)
1. Bail out if no topics are selected.
2. Abort any inflight request, create a new `AbortController`, and store it in the ref.
3. POST to `/api/papers` with `cache: "no-store"` so the backend always recomputes results.
4. On success, pass `result.papers` to `transformPapers`; on failure, set an error message.
5. Only clear `loading`/controller state if the resolving controller matches the latest ref.

## Audio Studio Handoff
- `handleStartAudioStudio` writes the selected `PaperCardData` to
  `sessionStorage.setItem('vps:selectedPaper', JSON.stringify(payload))`, including `storedAt` for
  freshness checks. Wrap the write in `try/catch` and always push to `/studio` afterwards.
- Keep this payload synchronised with the Audio Studio’s `SelectedPaper` type. Add fields in both
  places simultaneously and ensure they degrade gracefully if older entries are present.

## Styling Notes
- Tailwind utilities from `globals.css` (e.g., `gradient-primary`, `shadow-glow`) provide the
  gradient/glass look. Extend the CSS file instead of adding ad-hoc inline styles.
- Toggle buttons set `aria-pressed` and custom focus rings for accessibility.
- Empty and error states render friendly messaging with icons; keep them consistent when adding
  new states.

## Extension Guidelines
- **New topics** – Add entries to the `topics` array and update backend validation if the category
  format changes.
- **Extra filters** – Keep additional state reset within `handleClearSelection` so the Clear button
  restores the initial view.
- **Search integration** – The `Header` exposes a `search.onSearch` callback; debounce new fetches
  and reuse the existing `AbortController` pattern.
- **Paper actions** – Use `<Button asChild>` for external links to keep styling consistent and add
  `rel="noopener noreferrer"` on anchors.

## Testing Checklist
- Toggle topics quickly and ensure the request abort logic prevents stale results from flashing.
- Trigger error states by stopping the backend or forcing validation failures.
- Verify that selecting a paper, refreshing `/studio`, and returning to `/` keeps the latest
  selection available until cleared.
- Run `npm run lint` when modifying hooks or component structure.
