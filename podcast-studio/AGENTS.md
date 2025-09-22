# Virtual Podcast Studio – Design & UX System

## Scope & Foundations
- Applies to every UI and UX change inside `podcast-studio/`, including shared primitives, pages, API routes that render HTML, and MDX content.
- Build on the Tailwind tokens defined in `src/app/globals.css`; extend tokens there instead of hard-coding colours, spacings, or shadows.
- All guidance assumes SSR + hydration via Next.js App Router. Verify desktop (Chrome/Safari/Firefox) and mobile (iOS Safari + Android Chrome) before shipping.

## Interaction & Accessibility Principles
- **Keyboard first**: Every flow must be fully operable with a keyboard. Tab order follows visual order and respects WAI-ARIA Authoring Practices.
- **Focus treatments**: Use `:focus-visible` (not bare `:focus`) to render a clear ring on every focusable element; add `:focus-within` styles for grouped controls.
- **Focus management**: Trap focus inside modals/drawers, return it to the triggering control, and move focus intentionally when views change.
- **Hit targets**: Match the visual affordance. If the visible control is `< 24px`, expand the interactive target to at least 24px (44px minimum on mobile).
- **Comfortable inputs**: On mobile, ensure `<input>` font size ≥ 16px or declare `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />`.
- **Respect zoom**: Never disable page zoom or pinch gestures.
- **Hydration-safe fields**: Inputs must keep value and focus through hydration; avoid remounting components on load.
- **Paste-friendly**: Do not block paste on any `<input>` or `<textarea>`; surface validation errors instead.
- **Loading feedback**: Buttons entering a pending state keep their original label and show a spinner or progress indicator.
- **Stateful URLs**: Persist navigational state (filters, tabs, pagination, expanded panels) in the URL using tools like `nuqs` so share/refresh/back/forward work.
- **Optimistic updates**: Update the UI immediately when success is likely; reconcile on server response. On failure, show an error and roll back or offer Undo.
- **Ellipsis cues**: Commands that open follow-up steps end with an ellipsis character (`…`).
- **Confirm destructive work**: Provide confirmations or an Undo window before destructive actions complete.
- **Touch ergonomics**: Prevent accidental double-tap zoom on controls with `touch-action: manipulation` and set `-webkit-tap-highlight-color` to match the design system.
- **Forgiving controls**: Make interactions generous with clear affordances, no dead zones, and consistent pointer/keyboard behaviour.
- **Tooltip pacing**: Delay the first tooltip in a group; subsequent tooltips appear without delay.
- **Scroll behaviour**: Use `overscroll-behavior: contain` intentionally (e.g., modals/drawers) and persist scroll positions so browser Back/Forward restores prior scroll.
- **Contextual autofocus**: On desktop screens with a single primary input, autofocus it. Avoid autofocus on mobile to prevent keyboard-induced layout shifts.
- **Deep links everywhere**: Any state managed via `useState` (filters, tabs, expansion panels, pagination) must support deep-linking.
- **Clean drag interactions**: Disable text selection and apply `inert` (or aria-hidden/aria-disabled equivalents) to non-drag elements while dragging to avoid selection/hover conflicts.
- **Links behave like links**: Use `<a>`/`<Link>` for navigation so middle-click, Cmd/Ctrl+Click, and context menus work. Never swap in `<button>` or `<div>` for navigation.
- **Async announcements**: Expose polite `aria-live` regions for toasts, inline validation, and any optimistic updates that resolve asynchronously.
- **Locale-aware shortcuts**: Localise keyboard shortcuts for non-QWERTY layouts and render platform-specific symbols in UI hints.

## Motion & Animation
- Honour `prefers-reduced-motion`; provide reduced or static alternatives.
- Prefer CSS transitions/animations, then the Web Animations API, and use JS libraries only as a last resort.
- Animate compositor-friendly properties (`transform`, `opacity`) and avoid expensive layout-affecting properties (`width`, `height`, `top`, `left`).
- Animate only when it clarifies cause/effect or adds intentional delight. Skip gratuitous motion.
- Choose easing based on the change (distance, scale, weight) so motion feels natural.
- Ensure animations are interruptible—user input cancels or skips them.
- Trigger motion in response to user input; avoid autoplaying sequences.
- Set the transform origin so movement starts from the element’s “physical” origin.

## Layout & Responsiveness
- Adjust by a pixel when optical alignment looks better than strict geometry.
- Every element aligns intentionally to a grid, baseline, edge, or optical center—avoid accidental positioning.
- Balance contrast between adjacent text and icons (size, stroke, weight, colour) so they feel cohesive.
- Verify layouts on mobile, laptop, and ultra-wide screens (zoom out to 50% to simulate very wide displays).
- Respect safe areas (notches/insets) using `env(safe-area-inset-*)` variables where applicable.
- Avoid unnecessary scrollbars; resolve overflow issues rather than masking them.
- Let the browser handle sizing with flexbox/grid/intrinsic layout. Avoid JS measurement loops that trigger layout thrash.

## Content & Semantics
- Provide inline help before relying on tooltips; tooltips are a last resort.
- Skeleton loaders must mirror final content dimensions to avoid layout shifts.
- Ensure `<title>` reflects the current page context.
- Avoid dead ends—every screen presents a next step or recovery path.
- Design empty, sparse, dense, and error states up front.
- Use typographic (curly) quotes instead of straight quotes.
- Prevent widows/orphans and tidy rag/line breaks in rich text.
- Use tabular numbers (`font-variant-numeric: tabular-nums` or monospace) for comparative data.
- Pair colour cues with text labels so status is never colour-only.
- Icons always ship with visible or accessible text labels.
- Even when visuals omit labels, expose accessible names/labels so assistive tech receives the schema.
- Use the single-character ellipsis (`…`), not three periods.
- Apply `scroll-margin-top` to headings that serve as deep-link anchors.
- Ensure layouts handle very short and very long user-generated content without breaking.
- Format dates, times, numbers, delimiters, and currencies using the viewer’s locale.
- Set precise accessible names, hide decorative elements with `aria-hidden`, and verify the accessibility tree regularly.
- Icon-only buttons require descriptive `aria-label`s.
- Prefer native semantics (`button`, `a`, `label`, `table`, etc.) before adding ARIA roles.
- Maintain a hierarchical heading structure and include a "Skip to content" link.
- Make brand assets discoverable by allowing users to right-click the nav logo to access resources.
- Use non-breaking spaces (`&nbsp;` or `&NoBreak;`) to keep glued terms together (e.g., `10&nbsp;MB`, `⌘&nbsp;+&nbsp;K`).

## Forms & Inputs
- Pressing Enter in a text input submits its enclosing form.
- In `<textarea>`, `⌘/⌃ + Enter` submits; Enter alone inserts a new line.
- Every form control has an associated `<label>`; clicking the label focuses the control.
- Keep submit buttons enabled until submission starts; once in-flight, disable them, show a spinner, and attach an idempotency key.
- Do not block typing—even for numeric-only inputs. Accept input and provide validation feedback instead of suppressing keystrokes.
- Allow submitting incomplete forms so validation feedback surfaces.
- Expand checkbox/radio hit areas so the control and label share a generous, unified target.
- Place error messages adjacent to their fields and move focus to the first invalid control on submit.
- Configure `autocomplete` and meaningful `name` attributes to support autofill.
- Enable spellcheck selectively (disable for emails, codes, usernames, etc.).
- Use accurate `type` and `inputmode` values to trigger helpful keyboards and validation.
- Ensure placeholders signal emptiness and end with an ellipsis. Provide example formats (e.g., `+1 (123) 456-7890…`, `sk-0123456789…`).
- Warn users about unsaved changes before navigating away when data loss is possible.
- Support password managers and 2FA flows; never block pasting one-time codes.
- Trim trailing whitespace that may be introduced by text replacements/expansions before validation.
- Style native `<select>` with explicit `background-color` and `color` values to avoid Windows dark-mode contrast bugs.

## Performance & Quality
- Test against the device/browser matrix: iOS (including Low Power Mode) and macOS Safari at a minimum.
- Benchmark without extensions or tooling that alter runtime behaviour.
- Track React re-renders and minimise them; use React DevTools or React Scan as needed.
- When profiling, throttle CPU and network to expose bottlenecks.
- Batch DOM reads/writes to minimise layout/paint work.
- Target <500 ms for POST/PATCH/DELETE operations under normal conditions.
- Prefer uncontrolled inputs or inexpensive controlled loops to minimise keystroke cost.
- Virtualise large lists/tables (e.g., with `virtua`) instead of rendering the entire collection.
- Preload only above-the-fold imagery; lazy-load the rest.
- Prevent image-driven layout shifts by setting width/height (or aspect ratio) ahead of load.
- Use `<link rel="preconnect">` for external asset/CDN domains (include `crossorigin` when required).
- Preload critical fonts and subset them to the used glyph ranges/axes to reduce payload size.

## Visual Design & Theming
- Layer shadows to emulate ambient plus directional light.
- Combine semi-transparent borders with shadows for crisp edges.
- Keep nested border radii concentric—child radius ≤ parent radius.
- Tint borders, shadows, and text toward the same hue on non-neutral backgrounds for harmony.
- Choose colour palettes that remain legible for colour-blind users, especially in charts.
- Use APCA contrast targets for perceptual accuracy and ensure hover/focus/active states increase contrast over rest states.
- Align the browser UI with the page background via `<meta name="theme-color" content="#000000">` (update the value per theme).
- Avoid gradient banding; use dithering masks or adjusted stops when necessary.

## Copywriting & Voice (Vercel Preferences)
- Write in active voice with clear, concise, action-oriented language.
- Use Title Case (Chicago) for headings and buttons; switch to sentence case on marketing pages when appropriate.
- Prefer `&` over `and` and keep noun vocabulary consistent.
- Address the user directly (second person); avoid first-person voice.
- Use consistent placeholders (`YOUR_API_TOKEN_HERE` for strings, `0123456789` for numbers).
- Represent counts with numerals, not words.
- Maintain consistent currency formatting within a context (either 0 or 2 decimal places).
- Separate numbers and units with a non-breaking space (e.g., `10&nbsp;MB`).
- Frame messages positively and provide clear recovery steps for errors.
- Error copy must explain how to resolve the issue (e.g., regenerate credentials) and offer supporting actions.
- Labels and CTAs should be explicit (e.g., "Save API Key" instead of "Continue").
