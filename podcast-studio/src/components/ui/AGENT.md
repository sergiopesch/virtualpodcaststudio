# UI Components Agent Guide

## Purpose
Reusable UI primitives built on top of shadcn/ui (Radix UI + Tailwind) live in this folder.
They provide consistent theming for the Research Hub, Studio, and post-production pages.
Each component exports semantic props and uses the shared `cn` helper from
`src/lib/utils.ts`.

```
src/components/ui/
├── button.tsx        # cva-powered gradient buttons
├── card.tsx          # Glass/gradient cards with header/content slots
├── checkbox.tsx      # Radix checkbox, Tailwind focus styles
├── dropdown-menu.tsx # Workspace menu, keyboard friendly
├── scroll-area.tsx   # Styled viewport + scrollbar
├── sheet.tsx         # Settings drawer (Radix dialog)
├── tabs.tsx          # Timeline/analytics tab strip
└── AGENT.md          # This guide
```

## Component Notes
- **Button** (`button.tsx`)
  - Uses `class-variance-authority` to expose `variant` (`default`, `gradient`, `glass`,
    `outline`, etc.) and `size` props. Extend variants here before referencing them in pages.
  - `asChild` lets you wrap anchors (`<Button asChild><a/></Button>`), preserving focus
    styles.
- **Card** (`card.tsx`)
  - Layout-friendly slots (`CardHeader`, `CardContent`, `CardFooter`, etc.) with subtle
    borders and backdrop blur. Keep padding consistent—Research Hub and Studio rely on the
    default spacing.
- **Checkbox** (`checkbox.tsx`)
  - Wraps `@radix-ui/react-checkbox` with Tailwind focus rings. Only accepts boolean `checked`
    and `onCheckedChange` from Radix. Keep icons sized with `size-3.5` to align with topic
    toggles.
- **DropdownMenu** (`dropdown-menu.tsx`)
  - Provides menu items, separators, shortcuts, checkbox/radio items, and submenus. Each item
    forwards the `data-variant` attribute (default/destructive). Update this file if you need
    new menu surface styles rather than inlining overrides.
- **ScrollArea** (`scroll-area.tsx`)
  - Combines `ScrollArea.Root`, `.Viewport`, and `.Scrollbar` with custom thumb styling.
    Reuse for scrollable panels instead of raw `<div>` overflow to keep consistent
    scrollbar/keep-alive behaviour.
- **Sheet** (`sheet.tsx`)
  - Radix dialog configured as a sliding drawer (right/left/top/bottom). The Settings sheet
    depends on the `side="right"` animation classes—keep transitions intact when editing.
- **Tabs** (`tabs.tsx`)
  - Inline-flex tab list with active-state border and focus rings. Used heavily by the Video
    Studio; maintain the root/list/trigger/content structure so keyboard navigation works.

## Styling Conventions
- All components rely on the design tokens defined in `globals.css` (`gradient-primary`,
  `glass`, `shadow-*`). If you introduce a new visual treatment, add utility classes there
  rather than hard-coding hex values.
- Focus states come from Tailwind (`focus-visible:ring-[3px]` etc.). Keep them accessible and
  ensure `data-slot` attributes remain so design tooling can target them.
- When adding new components, prefer `@radix-ui` primitives to maintain accessibility. Follow
  the patterns above: wrap the primitive, apply Tailwind classes, and export named helpers.

## Usage Tips
- Import components via aliases (`@/components/ui/button`). The Next.js `tsconfig` path
  handles alias resolution.
- Compose shadcn components using the exported slots: e.g., `Card` + `CardHeader` +
  `CardContent`. Avoid creating ad-hoc wrappers in page files; extend the primitive if the
  pattern is shared.
- Keep props typed – extend `React.ComponentProps<typeof Primitive>` when adding options so
  TypeScript infers the correct attributes.

## Testing
- Visual regressions: run the Next.js dev server (`npm run dev`) and inspect focus/hover
  states in dark/light modes.
- Accessibility: validate keyboard navigation for DropdownMenu, Sheet, and Tabs when altering
  markup. Radix handles most ARIA attributes; avoid removing structural wrappers that provide
  them.
