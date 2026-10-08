# CLAUDE.md

Guidance for Claude Code in this repository: the **Medius documentation site**, built with SolidJS and MidnightUI components.

## Project

A static documentation site for Medius: replacement firmware for MAKCU-class mouse-passthrough boxes, its open binary control protocol, and the `medius` Rust library. Five sections:

| Section | What |
|---|---|
| Native API | Binary control protocol and box behaviour: hardware, transport, frame format, injection model, every command (opcodes `0x01`-`0x1E`). |
| Rust Library | `medius` crate reference: connecting, command bindings, keepalive, reconnect, and the `async` / `mock` / `tracing` features. |
| Bindings | C ABI and Python bindings over the crate. |
| Dashboard | In-browser box dashboard: connect, view the box, firmware update, recovery, device log, public usage stats. |
| AI Access | Markdown twins, `llms.txt`, and an MCP server. |

**MidnightUI** is the component library, in `src/components/` and `src/styles/`, synced from an upstream repo. Do not modify its source files.

## Tech stack

| Tool | Role |
|---|---|
| SolidJS + @solidjs/router | UI framework and client-side routing |
| Vite | Build tool (root set to `src/`) |
| Bun | Runtime and package manager |
| TypeScript | Language |
| MidnightUI | Component library (the CommandPalette, and the dashboard's panels and controls), restyled by the site theme |
| solid-icons (`solid-icons/bs`) | Bootstrap icons |

## Commands

```bash
bun run dev          # Dev server (http://localhost:3000)
bun run build        # Production build (output: dist/)
bun run serve        # Preview production build
bun run build:full   # Build and prerender every page, as the Docker image does
bun run crawlcheck   # After build:full: status, title, canonical and JSON-LD of every page
```

## Project structure

```
src/
  index.html                          # HTML entry point
  index.tsx                           # App bootstrap
  app/
    App.tsx                           # Router setup (all routes defined here)
    routes.ts                         # Route registry: every page's title, description, sidebar entry
    site.ts                           # Site URL, outside links (Discord, GitHub, crates.io, PyPI)
    RouteMeta.tsx                     # Per-route <head> from the registry, with structuredData.ts
    AiActions.tsx                     # The "use this page with an AI" menu beside the crumbs
    shell/                            # The site shell: SiteNav, SiteFooter, DocsSidebar, PageHeader, DocSection,
                                      # OnThisPage, IndexRow, ByteStrip, Arrow, motion.ts (scroll reveals)
    data/                             # FAQ, compatibility reports and their merge with the stats, the landing's
                                      # figures, and the bench captures the landing draws (never edited by hand)
    prism.ts                          # Syntax highlighting for code blocks
    searchIndex.ts                    # Curated search index for Ctrl+K search
    pages/
      Home.tsx                        # Landing page: hero and report feed, vitals, descriptor panel, index
      home/                           # The landing's blocks
      guide/                          # The Guide: install, update, compatibility, FAQ, troubleshooting, device fixes
      DocsLayout.tsx                  # Every other page: nav, sidebar, the page in main, on-this-page rail, search
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
        Stats.tsx                     # /dashboard/stats: public usage stats
  dashboard/                          # dashboard logic, not pages
    protocol/                         # opcodes, wire constants, payload builders, response parsers
    serial/                           # SerialLink, port discovery, connect verdicts
    flash/                            # image validation and flashing over Web Serial
    firmware/                         # release listing and asset download
    stats/                            # the stats sink, OS and browser reading, the totals fetch
  components/                         # MidnightUI components (DO NOT MODIFY)
  contexts/                           # form context (DO NOT MODIFY)
  utils/                              # shared helpers (DO NOT MODIFY)
  styles/
    global.css                        # MidnightUI theme tokens (DO NOT MODIFY)
    theme/                            # The site theme over MidnightUI: tokens, base, shell, content, components,
                                      # landing, motion (editable)
    components/                       # MidnightUI component styles (DO NOT MODIFY)
```

## Architecture

### Routing

`App.tsx` maps every path to its component; `src/app/routes.ts` holds each page's metadata, and a test keeps the two path lists equal. `DocsLayout` wraps each page with the nav, the sidebar, search, the on-this-page rail and the footer; the page renders the `PageHeader` (crumbs, h1, lead). The landing page (`Home.tsx`) sits outside it. The catch-all renders `NotFound.tsx` inside `DocsLayout`.

The prerender (`scripts/prerender.ts`, run by `build:full` and the Docker build) snapshots every registry page, the 404 page and Home, and writes `dist/routes.json`. `serve.ts` answers a registry path with its snapshot, 301s a trailing slash, a `.html` suffix or the wrong case to the registry path, and anything else with `dist/404.html` and status 404. The changelog and stats snapshots hold a `data-fill` block the server fills per request (`server/fill.ts`), so crawlers without JavaScript read the releases and totals. The landing's vitals and the compatibility table are filled the same way, but those pages (`SOFT_FILL_PATHS`) answer 200 as prerendered while a source is down, never 503.

### Search

Ctrl+K search is MidnightUI's `CommandPalette` over the curated list in `src/app/searchIndex.ts`. **Update the index when adding or changing pages.** Each entry has `label`, `description`, `path` (optionally with a `#hash` anchor), `group`, `keywords`, and an optional `icon`.

### Scroll targets

Every section is a `DocSection` with an id. It renders `section.doc-section` with `data-search-target`, so search and deep links scroll to it and highlight it (`scroll-padding-top` on `html` clears the fixed nav).

```tsx
<DocSection id="my-section" title="My section" caption="What it holds">
  ...
</DocSection>
```

### Sidebar

The sidebar is built from `src/app/routes.ts`: each entry's `section`, `group` (the group label) and `nav` (the label, at most 18 characters) place it, in registry order. `shell/DocsSidebar.tsx` renders the entries as router links, so crawlers can follow them, and builds the code-section switcher (Native, Rust, Bindings), the bindings language switcher and the search button. The AI & LLMs page sits at the foot of each code section. On a phone the sidebar opens full height from the bar under the nav.

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

`DocSection` -> intro `<p>` (one sentence, ends "Opcode `0xNN`.") -> `pre.api-signature` -> badge `<p>` -> `PAYLOAD` label + `byte-table` (or `<p>No payload (...).</p>`) -> optional detail table (`ACTIONS`/`TARGETS`/`LEVELS`/`SELECTORS`/`FLAGS`) -> `EFFECT` label + `<p>` (ends "Library binding: ...") -> `EXAMPLE` label + `ByteStrip`.

Library method sections (gold reference: `library/Move.tsx`): `pre.api-signature` (bare `fn name(...) -> T`) -> badge `<p>` under each signature -> a primary table under its ALL-CAPS semantic label -> description `<p>` -> `EXAMPLE` label + `<pre><code>`. Every table in a method section carries a label, and every code example carries `EXAMPLE`. The label names what the table holds: `PARAMETERS` (args), `RETURNS` (a returned struct's fields), `EFFECT` (state changes), `ACTIONS`/`BUTTONS`/`TARGETS`/`LEVELS` (enum detail), `FUNCTIONS`/`CONSTRUCTORS`/`QUERIES` (a grouped section's calls). Index and concept sections (Introduction, the Types page, `Connection#handshake`/`#zero-config`, `Lifecycle#keepalive`) use unlabeled tables and are not method sections.

### Capitalisation

- Table `<th>` headers: sentence case (first word capitalised, rest lowercase); code-identifier headers stay in `<code>` with source case.
- `byte-table` Notes cells: lowercase fragment, no trailing period.
- `api-params` description cells (Effect / Description / Meaning ...): full sentence, ending in a period.
- Short value/label/code cells: no trailing period.
- `api-response-label` divs: ALL-CAPS.

## Terseness

The signature, the table, and the example carry the content. Prose is near zero.
- Outside tables and code blocks, a section has AT MOST 2 short sentences (the page header at most 3). Prefer 1, or zero when the table and example already say it.
- Delete: narration and transitions ("you work in two halves", "first ... second ..."), second-person hand-holding ("you'll", "a junior wants", "so you can"), and any sentence that restates what a table or example already shows.
- If you're explaining how to use something in a paragraph, you're doing it wrong: put it in the example. If you're describing fields/variants in prose, put them in a table.
- When in doubt, cut.

## Styling

- Docs and Guide pages are built from the shell: `PageHeader` first, then a `DocSection` per section, `IndexRow` for a list of links, `ByteStrip` for a frame. The dashboard keeps MidnightUI's `Card` panels and controls.
- Site styles live in `src/styles/theme/`, imported after MidnightUI's `global.css` so its tokens win. Those files are editable; `global.css` and `src/components/` / `src/styles/components/` are not. Element styles take their scope through `:where()` so the spacing rules after a heading or a label win: 44px from the last ink to a section's rule, 44px from the rule to the heading's capitals, 24px from the heading's baseline to the content.
- No emojis except the ⚠️ on the USB3 hazard callout.
- Terse, declarative wording. No filler, no marketing language. De-AI it: no "robust/seamless/leverage", no "**Bold**: explanation" bullets, and use contractions.
- ASCII punctuation only. No em-dashes or en-dashes, ever (rewrite with commas, periods, parentheses, or "to" for ranges); no unicode minus (use "-"). Verify with a unicode-dash scan before committing.

### Page patterns

| Class | Used on | For |
|---|---|---|
| `PageHeader` | first element | The page's one h1 (its registry title), crumbs to the parent, the lead and the intro body. The lead is a plain sentence-case noun phrase, no trailing period |
| `DocSection` | every section | `id` (the anchor), `title`, `caption` (a sentence-case noun phrase, no trailing period) |
| `ByteStrip` | a frame on the wire | Each value over its field name, the payload lit apart from the framing |
| `api-signature` | `<pre>` | An opcode or method signature line only |
| `api-response-label` | `<div>` | ALL-CAPS labels. Native: PAYLOAD, EFFECT, EXAMPLE, ACTIONS, TARGETS, LEVELS, SELECTORS, FLAGS. Library adds: PARAMETERS, RETURNS, FUNCTIONS, CONSTRUCTORS, QUERIES, BUTTONS. |
| `api-params` | `<table>` | Parameter and reference tables, inside `<div class="table-scroll">` |
| `byte-table` | `<table>` | Wire and byte-layout tables (columns Offset / Field / Type / Notes), inside `<div class="table-scroll">` |
| `callout` | `<div>` | Notes (`--info`, `--warning`, `--danger`), labelled Note, Warning, Danger by the theme |
| `diagram` | `<pre>` | ASCII flow diagrams. A frame's bytes are a `ByteStrip`; an ASCII byte grid left elsewhere is fixed-width (each cell exactly 8 chars, `+--------+` borders), which conformance checks. |

**Badges.** One `api-badge` span under each signature.

| Modifier | Text | When |
|---|---|---|
| `--executed` (blue) | Fire-and-forget | It sends a frame and expects no reply |
| `--executed` (blue) | No round-trip | It touches no wire at all (type conversions, port scans, `logs`/`counters`) |
| `--responded` (white) | Blocks | It waits for the box's reply ("Returns RESP" / "Reply" on native) |
| `--warning` (amber) | Unsolicited | |

**Links.** Internal: the router `<A href="/...">`. External (crate, tool, chip, spec, std type): a
plain `<a href="https://..." target="_blank" rel="noreferrer">`. Link the first prose mention per
page, never inside a `<pre>` or another link, with a fixed URL (e.g. crates.io for a crate). Leave an
existing internal `<A>` alone; never wrap an external `<a>` around or inside it.

### Mobile

- Every table sits in `.table-scroll`, so a wide one scrolls inside its box and never the page. Avoid 3+ column tables with long `code` content all the same.
- Inline `code` wraps; `pre` blocks scroll inside their box.

## Favicon and social embeds

The favicon lives in `public/favicon.svg` (served at `/favicon.svg`). A PNG copy at `public/favicon.png` is the Open Graph / Twitter Card preview. `src/index.html` carries Home's head; `RouteMeta.tsx` rewrites title, description, canonical, Open Graph, Twitter and JSON-LD per route from the registry.

```bash
magick -background none -density 2048 public/favicon.svg -resize 1024x1024 public/favicon.png
```

## Content rules

- Native pages document the wire protocol and observable device behaviour, byte-exact. The authoritative source is the firmware's `docs/protocol/control-protocol.md`.
- Library pages document the `medius` crate as it is (1:1 firmware bindings plus connect/keepalive/reconnect infrastructure; no input automation or gestures).
- Document guarantees, not implementation tells. The firmware is closed; do not document the internal transparency/cloning mechanism (e.g. how baselines are seeded or how vendor fields are tracked), specific mouse-model quirks, or microsecond timing figures. State the guarantees (byte-identical clone, additive injection, native-equivalent idle, safety auto-clear) and the full protocol.
- Do not invent facts. If a value isn't confirmed, leave it out.

## Deployment

CI (`.github/workflows/ci.yml`) builds the app and a multi-arch Docker image on every push to `main`, pushing it to `ghcr.io/<repo>` (lowercased, so `ghcr.io/k4hvh/medius-docs`) and tagging `latest` on `main`. `docker-compose.yml` runs that image. The Dockerfile builds with Bun and serves `dist/` via `serve.ts`. Before the image build, CI runs `scripts/lastmod.mjs` with the full git history, writing each page's last commit date to `src/generated/lastmod.json` for the sitemap and `dateModified`; a local build has no dates.

## Usage stats

The dashboard reports each box it connects, the box's cloned device, and every flash to `POST /api/stats/event`; `GET /api/stats` serves the totals the Stats page draws. Both live in `server/stats/` and run under `serve.ts` and the vite dev server alike.

| Piece | Where |
|---|---|
| Database | SQLite at `STATS_DB` (default `data/stats.db`, ignored by git). `bun:sqlite` in production, `node:sqlite` under vite and vitest |
| Box identity | A keyed hash of the MAC; the key is made once and kept in the database. The raw MAC is never stored. Only a box event marks a box active |
| Country | Cloudflare's `CF-IPCountry`; no IP address is stored |
| Limits | 2 KB a body (read no further), 60 events a minute per client (an IPv6 /64 is one), 1200 a minute in all, foreign `Origin` refused; totals cached a minute |
| Production | The compose file's `medius-stats` volume at `/app/data`. Redeploy the stack with it, or every restart starts the counts again |

Unit tests never count: the provider builds no sink under vitest. A dev server writes to `data/stats.db` in the checkout, so delete that file to start the counts at zero.

## Adding a page

1. Create the component under `src/app/pages/`: a `PageHeader` (its `lead` and the intro body), then a `DocSection id="..."` per section.
2. Add a route in `App.tsx`.
3. Add its entry to `src/app/routes.ts` in sidebar order: section, group, nav label, icon, title, and a description of 50 to 155 characters that no other page uses.
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

## Landing captures

`src/app/data/descriptorSample.json` and `feedSample.json` are bench captures from medius-fw's
`tools/rig/descriptor_capture.py` (the mouse's descriptors read through the box beside the clone's, failing
on one differing byte) and `feed_capture.py` (the reports the PC took while MOVE injected into real
motion). Recapture them; never edit them by hand.

