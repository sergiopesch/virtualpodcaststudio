# Context Providers – Agent Guide

Two client-side React contexts live in this directory. Both are wired up in `src/app/layout.tsx` so
that every page shares the same state tree.

```
src/contexts/
├── sidebar-context.tsx    # Layout collapse state
├── api-config-context.tsx # Provider selection + API keys/models
└── AGENT.md               # This guide
```

## Sidebar Context (`sidebar-context.tsx`)
- `SidebarProvider` stores a boolean `collapsed` flag and exposes `toggleCollapsed` plus
  `setCollapsed`. The default is expanded (`false`).
- `useSidebar()` throws if accessed outside the provider—wrap standalone stories/tests accordingly.
- When adding new layout affordances (e.g., remembering collapse state per route), extend the context
  shape carefully. Many consumers destructure `{ collapsed, toggleCollapsed }` directly.

## API Config Context (`api-config-context.tsx`)
- `ApiConfigProvider` persists provider preferences and optional model overrides to localStorage
  under `vps:llmConfig`. API keys are stored in component state only (never persisted) for security.
- Hydration flow:
  1. On mount, read localStorage and normalise the provider (`openai` default, `google` supported for
     future use).
  2. `hasHydrated` prevents writes until the initial read completes.
  3. `setActiveProvider`, `setModel` update `preferences` which are serialised back to localStorage.
  4. `setApiKey` stores volatile keys in memory; `clearApiKey` simply blanks them.
- `useApiConfig()` exposes `{ activeProvider, apiKeys, models, setActiveProvider, setApiKey,
  clearApiKey, setModel }`. The Audio Studio reads this context before bootstrapping sessions.
- Keep the stored shape backwards compatible. If you add fields, extend `defaultPreferences` and use
  optional chaining when reading from parsed objects.

## Implementation Tips
- Both providers are client components (`"use client"`). Do not move them to the server; they access
  browser-only APIs like `localStorage`.
- Wrap new top-level providers in `src/app/layout.tsx` so server components can still render
  children.
- Avoid writing to `localStorage` during SSR. The existing hydration guard covers this—preserve the
  pattern when refactoring.

## Testing
- Manual: open the workspace settings sheet, change providers, set/clear API keys, refresh the page,
  and confirm the provider/model selection persists while keys reset (as designed).
- Automated: when adding logic, write React Testing Library tests that render consumers under the
  providers and exercise setter functions to ensure they do not throw in `jsdom` environments.
