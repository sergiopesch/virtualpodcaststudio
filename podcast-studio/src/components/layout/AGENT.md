# Layout Components – Agent Guide

The files in this directory compose the global chrome for every page: sidebar navigation,
header, and workspace/user menus. They are client components that assume the `SidebarProvider`
and `ApiConfigProvider` contexts are available (via `src/app/layout.tsx`).

```
src/components/layout/
├── sidebar.tsx   # Navigation + collapse controls
├── header.tsx    # Page title, status badges, search, actions
├── user-menu.tsx # Avatar dropdown + workspace settings sheet
└── AGENT.md      # This guide
```

## Sidebar (`sidebar.tsx`)
- Reads `useSidebar()` to toggle the collapsed state and highlights the active route via
  `usePathname()`.
- Accepts `isLiveRecording` to control the "LIVE" badge for the Audio Studio. Pass this prop
  from pages that manage realtime sessions to keep UX consistent.
- Navigation items are hard-coded (Research Hub, Audio Studio, Video Studio, Publisher, Library).
  When modifying, update both the icon and descriptive copy. Keep badges short; they render in a
  pill with Tailwind classes derived from `getBadgeColor`.

## Header (`header.tsx`)
- Displays the page title/description plus optional `status`, `timer`, `progress`, `actions`, and
  `search` props.
- `status` expects `{label, color, active}`. Colors map to Tailwind classes in helper functions;
  add new colors there if needed.
- `search.onSearch` currently just logs input. If you wire it up, debounce in the page component
  so the header stays stateless.
- Always render `<UserMenu />` as the last item so workspace settings are accessible on every
  page.

## User Menu (`user-menu.tsx`)
- Combines Radix `DropdownMenu` and `Sheet` primitives to show profile settings and workspace
  configuration.
- Uses `useApiConfig()` to read/write API provider selections and keys. Persisted values are
  trimmed before saving back to context/localStorage.
- Profile/workspace UI uses local component state with optimistic logging (`console.info`). If
  you integrate a backend, replace the logs with API calls but keep the separation between profile
  and workspace sections.
- The workspace sheet exposes checkboxes for preferences and forms for API keys. Maintain the
  base field class (`baseFieldClass`) for consistent styling when adding new inputs.

## Implementation Tips
- All components assume they are rendered as part of a responsive flex layout (see
  `src/app/page.tsx`). When adding new sections, ensure collapsed sidebar width (`w-16`) still
  accommodates icons without overflowing.
- Use icons from `lucide-react` and keep them sized with Tailwind `w-4 h-4`/`w-5 h-5` utilities
  to align with current spacing.
- Prefer `Button` variants defined in `src/components/ui/button.tsx` when adding actions—this
  keeps gradient/glass styling consistent.

## Testing
- Toggle the sidebar collapse/expand button at multiple viewport widths.
- Open the user menu, switch providers/keys, close the sheet, and reload the page to ensure
  settings persist and UI state resets.
- Validate keyboard navigation: tab through header controls, open the dropdown with Enter/Space,
  and ensure focus returns to the trigger on close.
