# CLAUDE.md

Guidance for Claude Code in this repository: the **Medius documentation site**, built with SolidJS and MidnightUI components.

## Project

A static documentation site for Medius: replacement firmware for MAKCU-class mouse-passthrough boxes, its open binary control protocol, and the `medius` Rust library. Five sections:

| Section | What |
|---|---|
| Native API | Binary control protocol and box behaviour: hardware, transport, frame format, injection model, every command (opcodes `0x01`-`0x1E`). |
| Rust Library | `medius` crate reference: connecting, command bindings, keepalive, reconnect, and the `async` / `mock` / `tracing` features. |
| Bindings | C ABI and Python bindings over the crate. |
| Dashboard | In-browser box dashboard: connect, view the box, firmware update, recovery, device log. |
| AI Access | Markdown twins, `llms.txt`, and an MCP server. |

**MidnightUI** is the component library, in `src/components/` and `src/styles/`, synced from an upstream repo. Do not modify its source files.

## Tech stack

| Tool | Role |
|---|---|
| SolidJS + @solidjs/router | UI framework and client-side routing |
| Vite | Build tool (root set to `src/`) |
| Bun | Runtime and package manager |
| TypeScript | Language |
| MidnightUI | Component library (Card, Tabs, Pane, Titlebar, CommandPalette, etc.) |
| solid-icons (`solid-icons/bs`) | Bootstrap icons |

## Commands

```bash
bun run dev          # Dev server (http://localhost:3000)
bun run build        # Production build (output: dist/)
bun run serve        # Preview production build
```

## Project structure

```
src/
  index.html                          # HTML entry point
  index.tsx                           # App bootstrap
  app/
    App.tsx                           # Router setup (all routes defined here)
    RouteMeta.tsx                     # Per-route title, meta tags and canonical URL
    AiActions.tsx                     # Titlebar "use this page with an AI" menu
    prism.ts                          # Syntax highlighting for code blocks
    searchIndex.ts                    # Curated search index for Ctrl+K search
    pages/
      Home.tsx                        # Landing page
      DocsLayout.tsx                  # Docs layout (sidebar, titlebar, search)
      AiAccess.tsx                    # Markdown twins, llms.txt, the MCP server
      native/
        Introduction.tsx              # Native API overview
        Quickstart.tsx                # Open the port and send a MOVE
        Architecture.tsx              # Mouse -> box -> PC data path
        Hardware.tsx                  # Three USB ports, the USB3 hazard
        Transport.tsx                 # 6 Mbaud framed serial, CH343, USB id
        Connection.tsx                # Handshake and the boot version hello
        Frame.tsx                     # Frame format, CRC16, opcodes
        Injection.tsx                 # Injection model, carry, emission, safety
        commands/                     # one page per command GROUP (not per opcode)
          Move.tsx                    # MOVE 0x01 (cursor + wheel)
          Inject.tsx                  # INJECT 0x03 (button/key/media)
          Requests.tsx                # QUERY 0x05, RESP 0x06, with VERSION/HEALTH layouts
          Admin.tsx                   # RESET 0x04, REBOOT 0x07, LOG 0x08
          Led.tsx                     # LED 0x09
          Lock.tsx                    # LOCK 0x0A
          Catch.tsx                   # CATCH 0x0B, MOTION_EVENT 0x0C, USAGE_EVENT 0x0F, TRAFFIC_EVENT 0x16
          Transform.tsx               # TRANSFORM 0x1E
          Option.tsx                  # OPTION 0x11
          Clip.tsx                    # CLIP_APPEND 0x12, CLIP_CTRL 0x13, CLIP_SET 0x14, CLIP_TRIGGER 0x15
          Update.tsx                  # UPDATE 0x17, UPDATE_RESP 0x18
          Raw.tsx                     # RAW 0x19 (advanced control)
          Transfer.tsx                # TRANSFER 0x1A, TRANSFER_RESP 0x1B (advanced control)
          Rewrite.tsx                 # REWRITE 0x1C (advanced control)
          Patch.tsx                   # PATCH 0x1D (advanced control)
          Usage.tsx                   # button/keycode/consumer usage id reference
        Flashing.tsx                  # Firmware updates over REBOOT
        Troubleshooting.tsx           # Common problems and fixes
      library/
        Introduction.tsx              # Rust library overview, install, features
        Connection.tsx                # open, find, handshake, threading
        Discovery.tsx                 # /library/discovery
        Inject.tsx                    # inject, press, soft_release, force_release
        Move.tsx                      # move_axis, move_rel, wheel
        Lock.tsx                      # /library/lock
        Catch.tsx                     # /library/catch
        Options.tsx                   # /library/options
        Clip.tsx                      # /library/clip
        Requests.tsx                  # query_version, query_health
        Led.tsx                       # /library/led
        Admin.tsx                     # reset, reboot
        Update.tsx                    # /library/update
        Lifecycle.tsx                 # keepalive, reapply, reconnect
        Diagnostics.tsx               # logs(), counters()
        Transform.tsx                 # /library/transform
        advanced/                     # the advanced control layer
          Raw.tsx  Transfer.tsx  Rewrite.tsx  Patch.tsx
        TypesAndErrors.tsx            # /library/types, the overview card over types/
        GuideCalls.tsx                # /library/guides/calls
        GuideConnection.tsx           # /library/guides/connection
        GuideTesting.tsx              # /library/guides/testing
        types/                        # split per-type reference
          Enums.tsx                   # DeviceKind, Button, Action, Class, Usage, Axis, RenderMode, and more
          Structs.tsx                 # Version, Health, DeviceInfo, Caps, ClipStatus, and more
          Frames.tsx                  # FrameType, DecodedFrame
          Errors.tsx                  # the Error enum and Result alias
        features/
          Async.tsx                   # AsyncDevice (async feature)
          Mock.tsx                    # MockBox (mock feature)
          Tracing.tsx                 # tracing (tracing feature)
      bindings/
        Overview.tsx                  # /bindings: which binding to pick, coverage
        c/                            # /bindings/c
          Install.tsx  Quickstart.tsx  Usage.tsx  Streams.tsx  Api.tsx  Types.tsx  Build.tsx
        python/                       # /bindings/python
          Install.tsx  Quickstart.tsx  Usage.tsx  Streams.tsx  Api.tsx  Types.tsx  Build.tsx
      dashboard/                      # the in-browser dashboard: pages and their cards
        context.tsx                   # DashboardProvider: connect, status, flash, update
        poll.ts                       # one shared poller behind every card's readback
        action.ts                     # createCommand: busy flag, error, follow-up read
        ConnectPanel.tsx              # Connect, and what a failed connect means
        PortDiagram.tsx               # the USB1 / USB2 / USB3 wiring diagrams
        Section.tsx                   # one labelled section inside a card
        ui.ts                         # style objects the cards share
        Device.tsx                    # /dashboard: your box, health, device log
        DeviceInfo.tsx                # Capabilities and Performance cards
        DeviceOptions.tsx             # Options card (name, imperfect, riding, bearing, emit rate)
        Control.tsx                   # /dashboard/control: the momentary controls
        DeviceInject.tsx              # Injection card
        DeviceLock.tsx                # Input locks card
        DeviceEventCatch.tsx          # Input catch card
        DeviceClip.tsx                # Clip playback card
        DeviceLed.tsx                 # Status light card
        UsagePicker.tsx               # class + usage picker shared by inject, lock and clip
        DeviceTransform.tsx           # Field transforms card
        DeviceDeveloper.tsx           # /dashboard/advanced-control: the advanced control layer
        DeviceRewrite.tsx             # Rewrite rules card
        DevicePatch.tsx               # Descriptor patches card (stored vs served, refused, full)
        DeviceRaw.tsx                 # Raw report card
        DeviceTransfer.tsx            # Control transfer card
        DeviceFactoryReset.tsx        # Factory reset card
        hex.ts                        # hex parsing, setup-packet fields, traffic class blurbs
        Setup.tsx                     # /dashboard/setup: the install wizard
        Update.tsx                    # /dashboard/update: one-click update
        Advanced.tsx                  # /dashboard/advanced: manual flash
        Changelog.tsx                 # /dashboard/changelog: release history
  dashboard/                          # dashboard logic, not pages
    protocol/                         # opcodes, wire constants, payload builders, response parsers
    serial/                           # SerialLink, port discovery, connect verdicts
    flash/                            # image validation and flashing over Web Serial
    firmware/                         # release listing and asset download
  components/                         # MidnightUI components (DO NOT MODIFY)
  contexts/                           # form context (DO NOT MODIFY)
  utils/                              # shared helpers (DO NOT MODIFY)
  styles/
    global.css                        # MidnightUI theme tokens (DO NOT MODIFY)
    docs.css                          # Documentation-specific styles (editable)
    components/                       # MidnightUI component styles (DO NOT MODIFY)
```

## Architecture

### Routing

`App.tsx` defines every route. `DocsLayout` wraps each docs page with the sidebar, titlebar, and search; the landing page (`Home.tsx`) sits outside it. A catch-all route redirects bad URLs to `/`.

### Search

Ctrl+K search is MidnightUI's `CommandPalette` over the curated list in `src/app/searchIndex.ts`. **Update the index when adding or changing pages.** Each entry has `label`, `description`, `path` (optionally with a `#hash` anchor), `group`, `keywords`, and an optional `icon`.

### Scroll targets

Every Card is wrapped in a `<div id="..." data-search-target>`, so search and deep links scroll to and highlight it (`scroll-margin-top` clears the sticky titlebar).

```tsx
<div id="my-section" data-search-target>
  <Card>
    <CardHeader title="My Section" />
  </Card>
</div>
```

### Sidebar

Sidebar tabs are arrays in `DocsLayout.tsx`: `nativeOverviewTabs`, `nativeProtocolTabs`, `nativeCommandTabs`, `nativeAdvancedTabs` (the advanced control commands: Raw, Transfer, Rewrite, Patch), `nativeReferenceTabs`, `libraryGettingStartedTabs`, `libraryApiTabs`, `libraryAdvancedTabs` (the advanced control layer: raw injection, control transfers, rewrite rules, descriptor patches), `libraryFeatureTabs`, `libraryGuidesTabs` (the guides: calls and input, connection, testing), `libraryReferenceTabs`, `aiAccessTabs` (the AI & LLMs page, at the foot of each code section), `dashboardTabs` (Set up, Device, Control, Advanced control, Update, Advanced, Changelog), `sectionTabs` (the four top-level sections), `bindingsSwitcherTabs` (Overview, C / C++, Python), and the per-language groups `makeBindingGroups(root)` builds (Getting Started: Install, First program; Usage: Calls & errors, Streams; Reference: API index, Types & errors; Build: Build & features). Add new pages to the right array. Nav icons come from `solid-icons/bs`.

## Consistency rules (read before editing)

### One table per fact set

Each fact set lives in ONE place; other pages link to it and never re-table it.

| Fact set | Lives only on | Note |
|---|---|---|
| Reboot targets | `commands/Admin.tsx` (`#reboot`) | Flashing, Troubleshooting and the update feature link there |
| HEALTH flags | `commands/Requests.tsx` (`#health`) | |
| Frame layout | `Frame.tsx` (`#layout`) | |
| Opcode list | `Frame.tsx` (`#opcodes`) | |
| Chip roles | `Architecture.tsx` | Elsewhere link the words "device chip" / "host chip" |
| `RESP(PATCHES)` flags (APPLIED, PENDING, REFUSED, FULL) | `commands/Requests.tsx` (`#patches`) | Patch pages describe presentation and link the bits |
| `TRAFFIC_EVENT` flags, the `RULE` bit, which side of the rewrite table each tap sits | `commands/Catch.tsx` (`#traffic-event`, `#rules`) | `Rewrite.tsx` links there |

Library enums and structs live ONCE, as per-type tables under `library/types/` (`Enums.tsx`, `Structs.tsx`, `Frames.tsx`, `Errors.tsx`; one row per variant or field, not a comma-list in a cell). Method pages link to Types and show usage in an example; they do NOT re-table variants or fields.

| Types | Table lives only on |
|---|---|
| Enums `Button`, `Action`, `Class`, `Usage`, `Axis`, `RebootTarget`, `LogLevel` | `library/types` (`#enums`) |
| Structs `Version`, `Health`, `LogLine`, `PortInfo`, `CountersSnapshot` | `library/types` (`#structs`) |
| `FrameType` / `DecodedFrame` | `library/types` (`#frames`) |
| `Error` variants | `library/types` (`#errors`) |

A method states what it returns in one sentence linking `library/types`, plus an example
(see `library/Requests.tsx`, `library/Diagnostics.tsx`).

Link to these; never paste a second copy with different columns. Verify with a grep that distinctive content (e.g. `>device download<`, `<th>Mask</th>`) appears in one file.

### Command section template

Every native opcode section uses one element order (gold references: `commands/Move.tsx`, `commands/Admin.tsx`):

`CardHeader` -> intro `<p>` (one sentence, ends "Opcode `0xNN`.") -> `pre.api-signature` -> badge `<p>` -> `PAYLOAD` label + `byte-table` (or `<p>No payload (...).</p>`) -> optional detail table (`ACTIONS`/`TARGETS`/`LEVELS`/`SELECTORS`/`FLAGS`) -> `EFFECT` label + `<p>` (ends "Library binding: ...") -> `EXAMPLE` label + `pre.diagram` byte grid.

Library method sections (gold reference: `library/Move.tsx`): `pre.api-signature` (bare `fn name(...) -> T`) -> badge `<p>` under each signature -> a primary table under its ALL-CAPS semantic label -> description `<p>` -> `EXAMPLE` label + `<pre><code>`. Every table in a method section carries a label, and every code example carries `EXAMPLE`. The label names what the table holds: `PARAMETERS` (args), `RETURNS` (a returned struct's fields), `EFFECT` (state changes), `ACTIONS`/`BUTTONS`/`TARGETS`/`LEVELS` (enum detail), `FUNCTIONS`/`CONSTRUCTORS`/`QUERIES` (a grouped section's calls). Index and concept cards (Introduction, the Types page, `Connection#handshake`/`#zero-config`, `Lifecycle#keepalive`) use unlabeled tables and are not method sections.

### Capitalisation

- Table `<th>` headers: sentence case (first word capitalised, rest lowercase); code-identifier headers stay in `<code>` with source case.
- `byte-table` Notes cells: lowercase fragment, no trailing period.
- `api-params` description cells (Effect / Description / Meaning ...): full sentence, ending in a period.
- Short value/label/code cells: no trailing period.
- `api-response-label` divs: ALL-CAPS.

## Terseness

The signature, the table, and the example carry the content. Prose is near zero.
- Outside tables and code blocks, a card has AT MOST 2 short sentences (the page's first/intro card at most 3). Prefer 1, or zero when the table and example already say it.
- Delete: narration and transitions ("you work in two halves", "first ... second ..."), second-person hand-holding ("you'll", "a junior wants", "so you can"), and any sentence that restates what a table or example already shows.
- If you're explaining how to use something in a paragraph, you're doing it wrong: put it in the example. If you're describing fields/variants in prose, put them in a table.
- When in doubt, cut.

## Styling

- Use MidnightUI components (Card, CardHeader, Divider) for all layout. Avoid custom CSS.
- Documentation-specific styles live in `src/styles/docs.css` (callouts, API badges, tables). This file is editable; `global.css` and `src/components/` / `src/styles/components/` are not.
- No emojis except the ⚠️ on the USB3 hazard callout.
- Terse, declarative wording. No filler, no marketing language. De-AI it: no "robust/seamless/leverage", no "**Bold**: explanation" bullets, and use contractions.
- ASCII punctuation only. No em-dashes or en-dashes, ever (rewrite with commas, periods, parentheses, or "to" for ranges); no unicode minus (use "-"). Verify with a unicode-dash scan before committing.

### Page patterns

| Class | Used on | For |
|---|---|---|
| (none) | `Card` | Every section. The first card is the page header (title + subtitle via `CardHeader`); subtitles are plain sentence-case noun phrases, no trailing period. |
| `api-signature` | `<pre>` | An opcode or method signature line only |
| `api-response-label` | `<div>` | ALL-CAPS labels. Native: PAYLOAD, EFFECT, EXAMPLE, ACTIONS, TARGETS, LEVELS, SELECTORS, FLAGS. Library adds: PARAMETERS, RETURNS, FUNCTIONS, CONSTRUCTORS, QUERIES, BUTTONS. |
| `api-params` | `<table>` | Parameter and reference tables |
| `byte-table` | `<table>` | Wire and byte-layout tables (columns Offset / Field / Type / Notes) |
| `callout` | `<div>` | Notes (`--info`, `--warning`, `--danger`) |
| `diagram` | `<pre>` | ASCII byte/flow diagrams. Byte breakdowns are fixed-width grids: each cell is exactly 8 chars (`+--------+` ASCII borders), byte on the top row, field label beneath, so columns can never drift. Verify with a script that every line in a grid is the same length. |

**Badges.** One `api-badge` span under each signature.

| Modifier | Text | When |
|---|---|---|
| `--executed` (green) | Fire-and-forget | It sends a frame and expects no reply |
| `--executed` (green) | No round-trip | It touches no wire at all (type conversions, port scans, `logs`/`counters`) |
| `--responded` (blue) | Blocks | It waits for the box's reply ("Returns RESP" / "Reply" on native) |
| `--warning` (yellow) | Unsolicited | |

**Links.** Internal: the router `<A href="/...">`. External (crate, tool, chip, spec, std type): a
plain `<a href="https://..." target="_blank" rel="noreferrer">`. Link the first prose mention per
page, never inside a `<pre>` or another link, with a fixed URL (e.g. crates.io for a crate). Leave an
existing internal `<A>` alone; never wrap an external `<a>` around or inside it.

### Mobile

- Tables must work on mobile. Avoid 3+ column tables with long `code` content.
- `code` elements are `white-space: nowrap` globally; long code strings in cells can overflow. Prefer plain-text descriptions in cells.
- `pre code` blocks override with `white-space: pre`. Cards use `overflow: hidden`.

## Favicon and social embeds

The favicon lives in `public/favicon.svg` (served at `/favicon.svg`). A PNG copy at `public/favicon.png` is the Open Graph / Twitter Card preview. Embed metadata is in `src/index.html`; the preview-image and canonical URLs are placeholders (`https://medius.example/...`); set the real domain before deploying.

```bash
magick -background none -density 2048 public/favicon.svg -resize 1024x1024 public/favicon.png
```

## Content rules

- Native pages document the wire protocol and observable device behaviour, byte-exact. The authoritative source is the firmware's `docs/protocol/control-protocol.md`.
- Library pages document the `medius` crate as it is (1:1 firmware bindings plus connect/keepalive/reconnect infrastructure; no input automation or gestures).
- Document guarantees, not implementation tells. The firmware is closed; do not document the internal transparency/cloning mechanism (e.g. how baselines are seeded or how vendor fields are tracked), specific mouse-model quirks, or microsecond timing figures. State the guarantees (byte-identical clone, additive injection, native-equivalent idle, safety auto-clear) and the full protocol.
- Do not invent facts. If a value isn't confirmed, leave it out.

## Deployment

CI (`.github/workflows/ci.yml`) builds the app and a multi-arch Docker image on every push to `main`, pushing it to `ghcr.io/<repo>` (lowercased, so `ghcr.io/k4hvh/medius-docs`) and tagging `latest` on `main`. `docker-compose.yml` runs that image. The Dockerfile builds with Bun and serves `dist/` via `serve.ts`.

## Adding a page

1. Create the component under `src/app/pages/`. Wrap every Card in `<div id="..." data-search-target>`.
2. Add a route in `App.tsx`.
3. Add a tab entry in the right array in `DocsLayout.tsx` (with a `solid-icons/bs` icon).
4. Add search entries to `searchIndex.ts` (page-level plus key section anchors).
5. Follow the command/method template and the consistency rules above. Link to canonical tables; never duplicate them.

## Conformance gate

`npm run conformance` (also run by `npm test` and CI) checks that every page is shaped like its
siblings, the drift that prose and correctness checks cannot see.

Every rule is **derived, not asserted**. A structural rule fires only where the corpus already agrees at
85% or better; a punctuation rule is measured against the page's **own** majority, so only stragglers on
an otherwise consistent page fire. Each rule prints the rate it was derived from, so changing the corpus
changes the rule.

Written against CLAUDE.md alone, the checker produced 466 "findings": 183 were one page's internally
consistent style and 116 were type cards measured as method sections. Measure first; a rule that fires
on the majority is wrong.

When it flags something you believe is correct, one of the two is wrong. If the page is right, teach
the rule the distinction the page makes (a dispatch card whose variants carry the examples, a byte grid
against a topology diagram). Never widen a threshold to quiet the report.
