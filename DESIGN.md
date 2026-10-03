# Stratdeck interface

Stratdeck is a quiet, dark reading surface for teammates consulting original Discord strategy notes alongside a game. Charcoal grounds, warm coral identifies actions and current selections, and screenshots remain the focus. The interface is an operating reader, not a HUD, dashboard, or game. It does not invent tactics, completion mechanics, statistics, or public team imagery.

## Visual system

- Ground `#191b1d`, rail `#121416`, controls/notes `#232629`, ink `#f0eeea`, muted `#a5a6a8`, rules `#373a3d`, coral links `#f18a7d`, and action fill `#ed897a` with dark ink.
- Local system sans-serif; no external font requests. Notes remain readable at 16px/1.7 and constrained line length.
- Flat ruled rows, clear category/source/title hierarchy, simple controls, and no ornamental telemetry.
- Desktop uses a category rail and fluid content. On narrow screens categories scroll horizontally and rows stack. Screenshots preserve aspect ratio and attachment order.

## Behavior and accessibility

Stable channel/message links, keyboard progression, explicit category/filter state, reduced-motion support, visible focus outlines, labeled controls, touch-friendly targets, accessible image dialog, and safe Markdown are retained. Empty, error, stale, unavailable, notes-only, and media-warning states have explicit messaging. Original source content is never rewritten.

## Provenance

The app and synthetic fixture are locally built; no live team screenshots or source content are embedded as public assets. The application design is separate from the Papermorph originating workspace; see `NOTICE`.
