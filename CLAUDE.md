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
        commands/                     # one page per command GROUP (not per opcode)
          Movement.tsx                # MOVE 0x01, WHEEL 0x02
          Buttons.tsx                 # BUTTON 0x03
          Requests.tsx                # QUERY 0x05, RESP 0x06, with VERSION/HEALTH layouts
          Admin.tsx                   # RESET 0x04, REBOOT 0x07, LOG 0x08
        Flashing.tsx                  # Firmware updates over REBOOT
        Troubleshooting.tsx           # Common problems and fixes
      library/
        Introduction.tsx              # Rust library overview, install, features
        Connection.tsx                # open, find, handshake, threading
        Movement.tsx                  # move_rel, wheel
        Buttons.tsx                   # press, soft_release, force_release, button
        Requests.tsx                  # query_version, query_health
        Admin.tsx                     # reset, reboot
        Lifecycle.tsx                 # keepalive, reapply, reconnect
        Diagnostics.tsx               # logs(), counters()
        TypesAndErrors.tsx            # public types and the Error enum
        features/
          Async.tsx                   # AsyncDevice (async feature)
          Mock.tsx                    # MockBox (mock feature)
          Flash.tsx                   # medius::flash (flash feature)
  components/                         # MidnightUI components (DO NOT MODIFY)
  styles/
    global.css                        # MidnightUI theme tokens (DO NOT MODIFY)
    docs.css                          # Documentation-specific styles (editable)
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

## Consistency rules (read before editing)

These exist because earlier passes drifted. Hold to them.

### Single source of truth -- never duplicate a table

Each fact set lives in exactly ONE place; every other page links to it, it does not re-table it.
- Reboot targets: only on `commands/Admin.tsx` (`#reboot`). Flashing, Troubleshooting, and the flash feature link there.
- HEALTH flags: only on `commands/Requests.tsx` (`#health`).
- Frame layout: only on `Frame.tsx` (`#layout`).
- Opcode list: only on `Frame.tsx` (`#opcodes`).
- Chip roles: only on `Architecture.tsx`; elsewhere link the words "device chip" / "host chip".

Library enum/struct semantics live on the METHOD page that uses them; `library/types` summarizes and links, it does not re-table them:
- `RebootTarget` effects: only on `library/Admin.tsx` (`#reboot`).
- `ButtonAction` effects: only on `library/Buttons.tsx` (`#methods`); `Button` ids: only on `library/Buttons.tsx` (`#button-arg`).
- `Health` / `Version` fields: only on `library/Requests.tsx`. `CountersSnapshot`: only on `library/Diagnostics.tsx` (`#counters`). `LogLevel`: only on `library/Diagnostics.tsx` (`#logs`).
- `Error` variants: only on `library/TypesAndErrors.tsx` (`#errors`); the handshake links there, it does not re-table the three handshake errors.

If you need to reference one of these, link to it. Do not paste a second copy with different columns -- that is the inconsistency this repo kept fighting. Verify with a grep that the distinctive content (e.g. `>device download<`, `<th>Mask</th>`) appears in one file.

### Command section template

Every native opcode section uses the same element order (gold references: `commands/Movement.tsx`, `commands/Admin.tsx`):

`CardHeader` -> intro `<p>` (one sentence, ends "Opcode `0xNN`.") -> `pre.api-signature` -> badge `<p>` -> `PAYLOAD` label + `byte-table` (or `<p>No payload (...).</p>`) -> optional detail table (`ACTIONS`/`TARGETS`/`LEVELS`/`SELECTORS`/`FLAGS`) -> `EFFECT` label + `<p>` (ends "Library binding: ...") -> `EXAMPLE` label + `pre.diagram` byte grid.

Library method sections (gold reference: `library/Movement.tsx`): `pre.api-signature` (bare `fn name(...) -> T`) -> badge `<p>` under each signature -> a primary table under its ALL-CAPS semantic label -> description `<p>` -> `EXAMPLE` label + `<pre><code>`. Every table in a method section carries a label, and every code example carries `EXAMPLE`. The label names what the table holds: `PARAMETERS` (args), `RETURNS` (a returned struct's fields), `EFFECT` (state changes), `ACTIONS`/`BUTTONS`/`TARGETS`/`LEVELS` (enum detail), `FUNCTIONS`/`CONSTRUCTORS`/`QUERIES` (a grouped section's calls). Index and concept cards (Introduction, the Types page, `Connection#handshake`/`#zero-config`, `Lifecycle#keepalive`) use unlabeled tables and are not method sections.

### Capitalization

- Table `<th>` headers: sentence case (first word capitalized, rest lowercase); code-identifier headers stay in `<code>` with source case.
- `byte-table` Notes cells: lowercase fragment, no trailing period.
- `api-params` description cells (Effect / Description / Meaning ...): full sentence, ending in a period.
- Short value/label/code cells: no trailing period.
- `api-response-label` divs: ALL-CAPS.

## Styling Rules

- Use MidnightUI components (Card, CardHeader, Divider) for all layout. Avoid custom CSS.
- Documentation-specific styles live in `src/styles/docs.css` (callouts, API badges, tables). This file is editable; `global.css` and `src/components/` / `src/styles/components/` are not.
- No emojis except the ⚠️ on the USB3 hazard callout.
- Terse, declarative wording. No filler, no marketing language. De-AI it (no "robust/seamless/leverage", no "**Bold**: explanation" bullets, contractions).

### Documentation Page Patterns

- **Cards** for every section; the first card is the page header (title + subtitle via `CardHeader`). Subtitles are plain sentence-case noun phrases, no trailing period.
- **`api-signature`** on `<pre>` for an opcode or method signature line only.
- **`api-response-label`** divs for ALL-CAPS labels. Native: PAYLOAD, EFFECT, EXAMPLE, ACTIONS, TARGETS, LEVELS, SELECTORS, FLAGS. Library adds: PARAMETERS, RETURNS, FUNCTIONS, CONSTRUCTORS, QUERIES, BUTTONS.
- **`api-badge`** spans, one under each signature. `--executed` (green) is instant: "Fire-and-forget" when it sends a frame and expects no reply, "No round-trip" when it touches no wire at all (type conversions, port scans, `logs`/`counters`). `--responded` (blue) "Blocks" waits for the box's reply ("Returns RESP" / "Reply" on native). `--warning` (yellow) "Unsolicited".
- **`api-params`** on parameter/reference tables; **`byte-table`** for wire/byte-layout tables (columns Offset / Field / Type / Notes).
- **`callout`** divs (`--info`, `--warning`, `--danger`) for notes.
- **`diagram`** on `<pre>` for ASCII byte/flow diagrams. Byte breakdowns are fixed-width grids: each cell is exactly 8 chars (`+--------+` ASCII borders), byte on the top row, field label beneath, so columns can never drift. Verify with a script that every line in a grid is the same length.

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

## Deployment

CI (`.github/workflows/ci.yml`) builds the app and a multi-arch Docker image on every push to `main`, pushing it to `ghcr.io/<repo>` (lowercased, so `ghcr.io/k4hvh/medius-docs`) and tagging `latest` on `main`. `docker-compose.yml` runs that image. The Dockerfile builds with Bun and serves `dist/` via `serve.ts`.

## Adding a New Page

1. Create the component under `src/app/pages/`. Wrap every Card in `<div id="..." data-search-target>`.
2. Add a route in `App.tsx`.
3. Add a tab entry in the right array in `DocsLayout.tsx` (with a `solid-icons/bs` icon).
4. Add search entries to `searchIndex.ts` (page-level plus key section anchors).
5. Follow the command/method template and the consistency rules above. Link to canonical tables; never duplicate them.
