# UI Components Agent Guide

## Purpose
Reusable shadcn-inspired primitives live in this directory. They wrap Radix UI components with the
Tailwind design tokens defined in `src/app/globals.css` and expose props consumed throughout the
Research Hub, Audio Studio, and post-production dashboards. All components re-export the shared
`cn()` helper from `@/lib/utils` to compose classes safely.

```
src/components/ui/
├── button.tsx        # cva-powered gradient/outline/button variants
├── card.tsx          # Glass/gradient cards with header/content slots
├── checkbox.tsx      # Radix checkbox with custom focus rings
├── dropdown-menu.tsx # Workspace menu primitives
├── scroll-area.tsx   # Styled scrollbars + viewport wrapper
├── sheet.tsx         # Sliding drawer built on Radix dialog
├── tabs.tsx          # Accessible tab list and content panels
└── AGENT.md          # This guide
```

## Component Notes
- **Button (`button.tsx`)** – Uses `class-variance-authority` to provide `variant` (`default`,
  `gradient`, `glass`, `outline`, `secondary`, `ghost`, `link`, `destructive`) and `size`
  (`xs`, `sm`, `default`, `lg`, `icon`) options. Supports `asChild` for anchor-wrapped buttons and
  applies consistent focus rings (`focus-visible:ring-*`).
- **Card (`card.tsx`)** – Provides `Card`, `CardHeader`, `CardTitle`, `CardContent`, etc. with glass
  backgrounds and subtle borders. Padding matches layout expectations; adjust tokens in
  `globals.css` if new spacing is required.
- **Checkbox (`checkbox.tsx`)** – Wraps `@radix-ui/react-checkbox` with rounded outlines and uses
  `lucide-react` icons sized to `size-3.5`. Exposes controlled props compatible with Radix.
- **Dropdown Menu (`dropdown-menu.tsx`)** – Re-exports Radix primitives with Tailwind styling,
  including support for checkbox/radio items and `data-variant="destructive"` states. Used by the
  user menu and workspace settings.
- **Scroll Area (`scroll-area.tsx`)** – Combines `ScrollArea.Root`, `.Viewport`, `.Scrollbar`, and
  `.Thumb` with gradient track styling. Prefer it over raw `overflow-y-auto` when you need
  consistent scrollbars.
- **Sheet (`sheet.tsx`)** – Implements a sliding drawer using `@radix-ui/react-dialog`. Supports
  `side` (`top`, `bottom`, `left`, `right`) and provides header/footer helpers. The Settings sheet
  relies on the right-side animation classes—update them centrally if you need new transitions.
- **Tabs (`tabs.tsx`)** – Wraps `@radix-ui/react-tabs` with keyboard-accessible triggers and focus
  outlines. Maintain the exported `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` structure so
  assistive technology works as expected.

## Styling Conventions
- Use gradient/glass tokens defined in `globals.css` (e.g., `gradient-primary`, `glass`,
  `shadow-glow`). If you need new visual treatments, add utility classes there instead of hard-
  coding colours.
- Focus states rely on Tailwind’s `focus-visible` utilities; keep them present for accessibility.
- Components set `data-slot` attributes where necessary (e.g., `<Button>`). Preserve them if you
  extend the markup so design tooling keeps targeting hooks.

## Usage Tips
- Import via path aliases (`@/components/ui/button`). TypeScript types are derived from the Radix
  primitives, so extend props using `React.ComponentProps<typeof Primitive>` patterns.
- Compose cards/buttons/etc. using their exported slots rather than duplicating markup in page
  components. If you need repeated patterns, extend the primitive instead of forking it.
- Keep new components client-safe unless they must run on the server. All current files are client
  components (`"use client"`) because they depend on Radix.

## Testing
- Visual inspection: run `npm run dev` and verify hover/focus/disabled states in dark and light
  backgrounds.
- Accessibility: tab through DropdownMenu, Sheet, and Tabs to ensure keyboard controls and focus
  management remain intact after changes.
