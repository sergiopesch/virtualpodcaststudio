# Context Providers – Agent Guide

Two React contexts live in this directory. Both are client components and are composed in
`src/app/layout.tsx` so every page shares the same state.

```
src/contexts/
├── sidebar-context.tsx   # Collapse state for layout chrome
├── api-config-context.tsx # Persisted API provider + keys
└── AGENT.md               # This guide
```

## Sidebar Context
- `SidebarProvider` stores a simple boolean `collapsed` state with `toggleCollapsed` and
  `setCollapsed` helpers.
- Any component calling `useSidebar()` must be rendered within the provider. The layout wrapper
  already does this, but unit tests or Storybook entries should wrap components explicitly.
- When adding new sidebar UI affordances (e.g., multi-column layouts), extend the context shape
  cautiously. Keep backwards compatibility in mind because many components destructure
  `collapsed` and `toggleCollapsed` directly.

## API Config Context
- `ApiConfigProvider` persists the user's chosen LLM provider (`openai` or `google`), API keys,
  and optional model overrides to `localStorage` under `vps:llmConfig`.
- Hydration flow:
  1. On mount, attempt to read and parse the stored JSON.
  2. `hasHydrated` guards against writing back until the initial read completes.
  3. Any state mutation (provider, key, model) re-serializes to `localStorage`.
- Consumers (`useApiConfig`) receive `{ activeProvider, apiKeys, models, setActiveProvider,
  setApiKey, clearApiKey, setModel }`.
- The Audio Studio relies on this context to gate `/api/rt/start` calls. Maintain the guard that
  falls back to the environment `OPENAI_API_KEY` only on the server—client components should
  always respect the user-specified keys.

## Implementation Tips
- Keep both providers client components (they access browser storage). Mark new providers with
  `"use client"` and wrap them in `layout.tsx` so Server Components can still render children.
- When extending the stored data shape, bump `defaultState` with sensible defaults and ensure
  migration logic handles older payloads gracefully (e.g., optional chaining when reading
  `parsed.apiKeys`).
- Avoid writing to `localStorage` during SSR. The current guard (`hasHydrated`) prevents this;
  preserve that pattern if you refactor.

## Testing
- Manual: open the Settings sheet, swap providers, add/remove API keys, refresh the page, and
  confirm the selections persist.
- Automated: consider writing React Testing Library tests that render consumers under the
  provider and exercise `setApiKey`/`clearApiKey` to ensure serialization does not throw in
  `jsdom`.
