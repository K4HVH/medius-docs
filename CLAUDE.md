# CLAUDE.md

Guidance for Claude Code when working in this repository. This is the **Medius documentation site**, built with SolidJS and MidnightUI components.

## What This Project Is

A static documentation site for Medius: replacement firmware for MAKCU-class mouse-passthrough boxes, its open binary control protocol, and the `medius` Rust library. Two sections:

- **Native API** -- The binary control protocol and how the box behaves. Covers hardware, transport, the frame format, the injection model, and every command (opcodes `0x01`-`0x08`).
- **Rust Library** -- API reference for the `medius` crate: connecting, the command bindings, keepalive and reconnect, and the `async` / `mock` / `flash` features.

The site uses **MidnightUI** as its component library. MidnightUI components live in `src/components/` and `src/styles/` and are synced from an upstream repo. Do not modify MidnightUI component source files.

## Tech Stack

- **SolidJS** + **@solidjs/router** -- UI framework and client-side routing
- **Vite** -- Build tool (root set to `src/`)
- **Bun** -- Runtime and package manager
- **TypeScript**
- **MidnightUI** -- Component library (Card, Tabs, Pane, Titlebar, CommandPalette, etc.)
- **solid-icons** (`solid-icons/bs`) -- Bootstrap icons

## Commands

```bash
bun run dev          # Dev server (http://localhost:3000)
bun run build        # Production build (output: dist/)
bun run serve        # Preview production build
```

## Project Structure

```
src/
  index.html                          # HTML entry point
  index.tsx                           # App bootstrap
  app/
    App.tsx                           # Router setup (all routes defined here)
    searchIndex.ts                    # Curated search index for Ctrl+K search
    pages/
      Home.tsx                        # Landing page
      DocsLayout.tsx                  # Docs layout (sidebar, titlebar, search)
      native/
        Introduction.tsx              # Native API overview
        Quickstart.tsx                # Open the port and send a MOVE
        Architecture.tsx              # Mouse -> box -> PC data path
        Hardware.tsx                  # Three USB ports, the USB3 hazard
        Transport.tsx                 # 4 Mbaud framed serial, CH343, USB id
        Connection.tsx                # Handshake and the boot version hello
        Frame.tsx                     # Frame format, CRC16, opcodes
        Injection.tsx                 # Injection model, carry, emission, safety
        commands/
          Movement.tsx                # MOVE 0x01
          Wheel.tsx                   # WHEEL 0x02
          Buttons.tsx                 # BUTTON 0x03
          Reset.tsx                   # RESET 0x04
          Version.tsx                 # QUERY/RESP VERSION (0x05/0x06)
          Health.tsx                  # QUERY/RESP HEALTH
          Reboot.tsx                  # REBOOT 0x07
          Log.tsx                     # LOG 0x08
        Flashing.tsx                  # Firmware updates over REBOOT
        Troubleshooting.tsx           # Common problems and fixes
      library/
        Introduction.tsx              # Rust library overview, install, features
        Connection.tsx                # open, find, handshake, threading
        Movement.tsx                  # move_rel
        Wheel.tsx                     # wheel
        Buttons.tsx                   # press, soft_release, force_release, button
        Reset.tsx                     # reset
        Version.tsx                   # query_version
        Health.tsx                    # query_health
        Lifecycle.tsx                 # keepalive, reapply, reconnect
        Reboot.tsx                    # reboot
        Diagnostics.tsx               # logs(), counters()
        TypesAndErrors.tsx            # public types and the Error enum
        features/
          Async.tsx                   # AsyncDevice (async feature)
          Mock.tsx                    # MockBox (mock feature)
          Flash.tsx                   # medius::flash (flash feature)
  components/                         # MidnightUI components (DO NOT MODIFY)
  styles/
    global.css                        # MidnightUI theme tokens (DO NOT MODIFY)
    docs.css                          # Documentation-specific styles
    components/                       # MidnightUI component styles (DO NOT MODIFY)
```

## Key Architecture

### Routing

All routes are defined in `App.tsx`. `DocsLayout` is the layout component for all docs pages -- it provides the sidebar, titlebar, and search. The landing page (`Home.tsx`) is outside the docs layout. Bad URLs redirect to `/` via a catch-all route.

### Search System

Ctrl+K search is powered by MidnightUI's `CommandPalette`. The search index is a curated list in `src/app/searchIndex.ts`. **When adding or modifying pages, update the search index.** Each entry has `label`, `description`, `path` (optionally with a `#hash` anchor), `group`, `keywords`, and an optional `icon`.

### Scroll Targets

Every Card is wrapped in a `<div id="..." data-search-target>`. This lets search and deep links scroll to a section and highlight it, with `scroll-margin-top` for the sticky titlebar.

```tsx
<div id="my-section" data-search-target>
  <Card>
    <CardHeader title="My Section" />
  </Card>
</div>
```

### Sidebar Navigation

Sidebar tabs are arrays in `DocsLayout.tsx`: `nativeOverviewTabs`, `nativeProtocolTabs`, `nativeCommandTabs`, `nativeReferenceTabs`, `libraryGettingStartedTabs`, `libraryApiTabs`, `libraryFeatureTabs`, `libraryReferenceTabs`. Add new pages to the right array. Nav icons come from `solid-icons/bs`.

## Styling Rules

- Use MidnightUI components (Card, CardHeader, Divider) for all layout. Avoid custom CSS.
- Documentation-specific styles live in `src/styles/docs.css` (callouts, API badges, tables).
- Do not modify `global.css` or anything under `src/components/` or `src/styles/components/`.
- No emojis except the ⚠️ on the USB3 hazard callout.
- Terse, declarative wording. No filler, no marketing language.

### Documentation Page Patterns

- **Cards** for every section; the first card is the page header (title + subtitle via `CardHeader`).
- **`api-signature`** on `<pre>` for an opcode or method signature line.
- **`api-response-label`** divs for small uppercase labels (PAYLOAD, EFFECT, EXAMPLE).
- **`api-badge`** spans for badges: `--executed` (green, "Fire-and-forget"), `--responded` (blue, "Returns RESP").
- **`api-params`** on parameter/reference tables; **`byte-table`** for wire/byte-layout tables.
- **`callout`** divs (`--info`, `--warning`, `--danger`) for notes.
- **`diagram`** on `<pre>` for ASCII diagrams.

### Mobile Considerations

- Tables must work on mobile. Avoid 3+ column tables with long `code` content.
- `code` elements are `white-space: nowrap` globally; long code strings in cells can overflow. Prefer plain-text descriptions in cells.
- `pre code` blocks override with `white-space: pre`. Cards use `overflow: hidden`.

## Favicon and Social Embeds

The favicon lives in `public/favicon.svg` (served at `/favicon.svg`). A PNG copy at `public/favicon.png` is the Open Graph / Twitter Card preview. Embed metadata is in `src/index.html`; the preview-image and canonical URLs are placeholders (`https://medius.example/...`) -- set the real domain before deploying.

```bash
magick -background none -density 2048 public/favicon.svg -resize 1024x1024 public/favicon.png
```

## Content Rules

- Native pages document the wire protocol and observable device behavior, byte-exact. The authoritative source is the firmware's `docs/protocol/control-protocol.md`.
- Library pages document the `medius` crate as it actually is (1:1 firmware bindings plus connect/keepalive/reconnect infrastructure; no input automation or gestures).
- Document guarantees, not implementation tells. The firmware is closed; do not document the internal transparency/cloning mechanism (e.g. how baselines are seeded or how vendor fields are tracked), specific mouse-model quirks, or microsecond timing figures. State the guarantees (byte-identical clone, additive injection, native-equivalent idle, safety auto-clear) and the full protocol.
- Do not invent facts. If a value isn't confirmed, leave it out.

## Adding a New Page

1. Create the component under `src/app/pages/`. Wrap every Card in `<div id="..." data-search-target>`.
2. Add a route in `App.tsx`.
3. Add a tab entry in the right array in `DocsLayout.tsx` (with a `solid-icons/bs` icon).
4. Add search entries to `searchIndex.ts` (page-level plus key section anchors).
5. Follow existing page patterns.
