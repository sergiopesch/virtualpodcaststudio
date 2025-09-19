# Layout Components – Agent Guide

The components in this directory provide the global chrome rendered on every page: sidebar
navigation, header, and the workspace/user menu. They are client components that assume the
`SidebarProvider` and `ApiConfigProvider` wrappers from `src/app/layout.tsx` are present.

```
src/components/layout/
├── sidebar.tsx    # Navigation, collapse controls, LIVE badge
├── header.tsx     # Page title, status chips, timer, search, actions
├── user-menu.tsx  # Avatar dropdown + workspace settings sheet
└── AGENT.md       # This guide
```

## Sidebar (`sidebar.tsx`)
- Reads `useSidebar()` to show the current collapse state and toggles via the menu button.
- Navigation is defined inline (`Research Hub`, `Audio Studio`, `Video Studio`, `Publisher`,
  `Episode Library`, `Analytics`). Update both `name`/`description`/`icon` when changing items.
- Accepts `isLiveRecording`; when true, the “LIVE” badge remains visible for the Audio Studio entry.
- Collapsed mode reduces the sidebar to icons only—ensure new items include tooltip-friendly
  `name` values.
- `getBadgeColor` maps badge labels to Tailwind classes. Add new cases there if you introduce more
  badges.

## Header (`header.tsx`)
- Displays `title`/`description` alongside optional `status`, `timer`, `progress`, `actions`, and
  `search` props.
- `status` expects `{label, color, active}` where color is one of `green`, `red`, `yellow`, `blue`,
  `gray`. Helpers convert these into pulse dots and text colours.
- `timer` renders a formatted duration with a clock icon. Pass a formatter that handles seconds.
- `progress` shows a horizontal progress bar and optional label.
- `search` renders an inline input with an icon and calls `onSearch` on change; debounce upstream if
  you wire it to network requests.
- Always render `<UserMenu />` as the trailing element so workspace settings remain accessible.

## User Menu (`user-menu.tsx`)
- Combines Radix DropdownMenu and Sheet primitives. Clicking menu items opens the sheet with either
  profile or workspace settings.
- Reads and writes API configuration via `useApiConfig()`, trimming keys before persisting them with
  `setApiKey`. Keys remain in-memory only.
- Maintains local `workspacePreferences` state (theme, autosave, analytics flags). Currently these
  are logged in `handleSave`—replace logging with real API calls if backend persistence is added.
- Generates user initials from the display name for the avatar badge.
- The workspace sheet exposes checkboxes and text inputs styled with `baseFieldClass`. Reuse this
  class when adding new form controls for consistent spacing.

## Implementation Tips
- Layout components expect to be rendered within a flex container (`Sidebar` + main content). Ensure
  new wrappers preserve the flex structure so collapse animations remain smooth.
- Use icons from `lucide-react` sized with Tailwind (`w-4 h-4`, `w-5 h-5`) to match existing spacing.
- Keep focus/ARIA attributes intact (e.g., `aria-label` on the collapse button, keyboard navigation
  for the dropdown and sheet).

## Testing
- Toggle the sidebar at various viewport widths to confirm collapse animations and tooltips behave.
- Open the user menu, adjust provider/API keys, close the sheet, refresh, and ensure provider
  selections persist via context/localStorage.
- Tab through header controls to verify keyboard focus order and that focus returns to the trigger
  when the sheet closes.
