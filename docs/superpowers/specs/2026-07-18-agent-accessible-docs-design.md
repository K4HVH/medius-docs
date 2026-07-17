# Agent-accessible Medius docs

Date: 2026-07-18
Status: proposed (design approved in shape; spec under review)
Repo: `medius-docs` (SolidJS + Vite + Bun, deployed at https://medius.k4tech.net)

## Problem

The docs are a client-rendered SolidJS SPA. A fetch of any URL returns an empty
`<div id="root"></div>` shell plus a JS bundle; the only text in the HTML is the
`<title>`. Every agent that reads a URL without running JS (Claude/ChatGPT
WebFetch, curl, Cursor `@web`, ClaudeBot, GPTBot, PerplexityBot, and even
Googlebot's fast pass) sees no content. So the docs are effectively invisible to
AI agents and search crawlers.

## Goal

Make the whole docs corpus usable by agents through four channels, all derived
from one build-time crawl:

1. Per-page Markdown twins, served on `/<route>.md` and via
   `Accept: text/markdown` on the canonical URL. (Highest ROI: works for any
   URL-fetching agent, ~80-90% fewer tokens than HTML.)
2. A remote MCP server at `/mcp` (`search_docs` / `get_page` / `list_pages`) for
   coding agents that speak MCP (Claude Code, Cursor, Windsurf, VS Code).
3. Prerendered static HTML per route (SSG), so crawlers and JS-less bots see real
   content and the human site stops being an empty shell.
4. `llms.txt` + `llms-full.txt` discovery files, plus `sitemap.xml` and a
   crawler-permissive `robots.txt`.

Evidence note on priority: an Ahrefs May-2026 study of 137k domains found 97% of
published `llms.txt` files get zero fetches and no AI crawler treats it as a
discovery entry point (John Mueller confirms Google's AI does not read it). The
value that is real flows through the Markdown content and MCP, which coding
agents (Claude Code most of all) do consume. So `llms.txt` ships as a cheap
byproduct, not a headline feature; the `.md` twins + MCP are the load-bearing
work.

## Non-goals

- No migration to SolidStart or true SSR/hydration. The prerender is
  render-for-crawlers, not hydration (see "Client-side" below).
- No content rewriting. The extractor reads whatever content the page `.tsx`
  files render; authoring stays exactly as it is.
- No UA sniffing. Markdown is served only on explicit signals (`.md` suffix or
  `Accept: text/markdown`). No serving-different-content-to-bots.
- Dashboard pages (`/dashboard/*`) are live stateful device UIs with no static
  form; only `dashboard/changelog` is prose. Dashboard routes are excluded from
  extraction (they keep the normal SPA shell).

## Current state (facts that shape the design)

- Build: `vite build` -> `dist/` (SPA shell + hashed JS/CSS). Prod serves `dist/`
  with a custom `Bun.serve` in `serve.ts`, in a Docker image
  (`ghcr.io/k4hvh/medius-docs`), fronted by a reverse proxy at the domain.
- `serve.ts` already: runs `handleFirmwareApi(req) -> Response | null` first, then
  serves an exact file, then `filePath + ".html"`, then directory `index.html`,
  then falls back to `index.html` for SPA routing. So `/route.html` and
  `/route.md` files are served automatically once they exist on disk.
- Content model: ~61 doc pages, all static JSX with a fixed, documented class
  vocabulary. Rendered-DOM counts from the codebase audit: `table.api-params`
  x312, `div.api-response-label` x350, `pre.api-signature` x181,
  `code.language-*` x145 (rust 109, bash 23, c 12, python 11), `div.callout--*`
  x96 (info 55, warning 30, danger 11), `pre.diagram` x55, `table.byte-table` x29
  (two header schemas), `span.api-badge` x134, `data-search-target` anchors x364.
  Tables already emit real `<thead>/<th>`.
- `src/app/searchIndex.ts`: a curated index covering every doc + dashboard route
  (verified complete vs `App.tsx`) with `label`, `description`, `path`, `group`,
  `keywords`, plus 364 sub-anchor entries. Strong backbone for `llms.txt`, the
  route->meta map, and the MCP search index. (Only the `/` Home route and the JSX
  `icon` field are not usable as data.)
- Hardware safety for the crawl: every `navigator.serial.requestPort` is gated
  behind a click handler; nothing opens a port or runs esptool-js/spark-md5 on
  mount. A real headless Chromium renders every route with no USB prompt, as long
  as the crawler does not click Connect/Update/Advanced/flash. The one auto side
  effect is `createResource(fetchReleases)` on `/dashboard/update` and
  `/dashboard/advanced` (same-origin fetch, fails gracefully); dashboard pages are
  excluded from the crawl anyway.

## Architecture: one crawl, four channels

```
  vite build ─▶ dist/ (SPA shell + JS/CSS, unchanged)
                   │
                   ▼
  prerender crawl  (Playwright/Chromium, run under NODE, over the built SPA
                    served locally with SPA fallback; ~61 doc routes)
     per route:  DOM snapshot ─▶ dist/<route>.html   (SSG; content in HTML)
                 main node ─▶ turndown ─▶ dist/<route>.md   (markdown twin)
                   │
                   ├─ concat ordered .md ────────▶ dist/llms-full.txt
                   ├─ searchIndex + summaries ───▶ dist/llms.txt
                   ├─ routes ────────────────────▶ dist/sitemap.xml
                   ├─ static template ───────────▶ dist/robots.txt
                   └─ path+title+headings+text ──▶ dist/agent-index.json (MCP)

  Bun serve.ts  (adds one sibling handler; everything else already works):
     handleAgentDocs(req) ─▶ Response | null
        /mcp (POST,GET)                       ─▶ mcp-lite handler (stateless)
        canonical route + Accept: text/markdown ─▶ the .md, Vary: Accept
     (fallthrough) exact file / <route>.html / <route>.md / llms.txt /
        sitemap.xml / robots.txt  ─▶ already served by existing static logic
```

The synergy: SSG HTML and the `.md` twins are the same crawl; `llms.txt`,
`llms-full.txt`, `sitemap.xml`, and the MCP index are all derived from artifacts
we already have (`searchIndex.ts` + the markdown corpus). "Everything" is one
pipeline with four cheap outlets, not four projects.

## Component 1: prerender + extract pipeline

New file: `scripts/prerender.mjs` (or `.ts` run via `tsx`), run under Node at
build time (NOT Bun; Playwright's Chromium launch is unreliable under Bun as of
2026). Playwright is a build-only devDependency; nothing ships to the runtime.

Flow:
1. Start a local static server over `dist/` with SPA fallback (reuse `serve.ts`'s
   fallback via a tiny wrapper, or `sirv dist --single`, or `vite preview`).
2. Read the route list from a single source (`routes.ts`, derived from the
   sidebar/`searchIndex`), excluding `/` (Home keeps its own tuned shell) and all
   `/dashboard/*` routes.
3. Launch one Chromium, reuse one page/context across routes.
4. Per route: `page.goto(url, { waitUntil: 'networkidle' })`, then
   `waitForSelector('[data-search-target]')` (proves Solid mounted), then a
   Prism-done check on pages that contain code (`waitForFunction` that a
   `pre code .token` exists, guarded so code-less pages do not block). Optional
   hardening: the app sets `window.__PRERENDER_READY` after mount + Prism; the
   crawl waits on it. Decide in the plan whether to add the flag or rely on
   selector waits only.
5. The per-route head is already correct in the DOM: `@solidjs/meta` sets
   `<title>/<meta>/<link rel=canonical>` at render (Component 6), so the crawl
   just captures it. Then:
   - write `outerHTML` to `dist/<route>.html`
   - pass the main content node's `outerHTML` to turndown -> `dist/<route>.md`
6. After the loop, emit the derived artifacts (Component 3), then tear down the
   browser and the local server.

Determinism: no timestamps in outputs; stable ordering from the route list so
diffs are clean and CI is reproducible.

## Component 2: DOM -> Markdown

New file: `scripts/lib/htmlToMarkdown.ts`. `turndown` + `turndown-plugin-gfm`
(`tables`) in Node, `codeBlockStyle: 'fenced'`, `headingStyle: 'atx'`,
`bulletListMarker: '-'`. The built-in fenced rule handles `pre>code.language-X`
(reads `textContent`, so Prism `.token` spans drop out for free) and picks the
language from the `language-*` class. Custom `addRule`s:

| Source pattern | Markdown target |
|---|---|
| `pre.api-signature` (bare `<pre>`, no `<code>`) | fenced block ` ```text `, verbatim `textContent` (custom rule; turndown has no default `pre` rule and collapses whitespace) |
| `pre.diagram` (bare `<pre>`) | fenced block, whitespace preserved exactly, never reflowed |
| `pre > code.language-*` | ` ```lang ` fenced block (built-in rule; optional normalizer to sanitize the lang token) |
| `table.api-params`, `table.byte-table` | GFM pipe table (needs real `<thead>/<th>`, which the pages already emit) |
| `div.api-response-label` (all-caps sub-label) | `#### LABEL` heading |
| `span.api-badge` | inline ` (Fire-and-forget)` etc. after the signature line |
| `div.callout--info/warning/danger` | blockquote prefixed `> **Note/Warning/Danger**` |
| internal `<A href="/x">` | rewrite to `/x.md` (agents follow markdown to markdown) |
| external `<a href="https://...">` | plain markdown link, unchanged |
| CardHeader (`.card-title` / `.card-subtitle`) | `## Title` + `*subtitle*` |

Gotchas locked from source review: no default `pre` rule (the two bare-`<pre>`
classes MUST get custom rules or diagram alignment is destroyed); GFM tables need
a `<thead>` with `<th>` or the plugin silently keeps raw HTML (pages comply);
read code bodies via `textContent` to strip Prism. Alternative noted if turndown
throughput ever bites: `mdream` (faster, fewer tokens) as a drop-in swap.

## Component 3: derived artifacts

- `dist/<route>.md`: one clean Markdown file per doc route. Front matter optional
  (title, canonical URL, source path). Internal links point to other `.md`.
- `dist/llms-full.txt`: all `.md` concatenated in sidebar order, each prefixed
  with an `# H1` route title and its canonical URL. One file, whole corpus.
- `dist/llms.txt`: llmstxt.org format. `# Medius` H1, a `>` blockquote summary,
  then `## Section` lists of `- [Title](https://medius.k4tech.net/route.md):
  description` built from `searchIndex.ts` grouping (Native API, Rust Library,
  Bindings, Dashboard). Under ~10 KB.
- `dist/sitemap.xml`: all canonical HTML routes (not the `.md`), lastmod from the
  build (single build date, no per-file churn).
- `dist/robots.txt`: allow all, allow AI crawlers explicitly (GPTBot, ClaudeBot,
  PerplexityBot, Google-Extended, etc.), point to the sitemap and `llms.txt`.
- `dist/agent-index.json`: `[{ path, title, section, headings[], text }]` for
  each page, built from `searchIndex.ts` + extracted section text. Powers MCP
  `search_docs` and `list_pages`. Read-only at runtime.

## Component 4: server integration

New file: `server/agent.ts`, exporting `handleAgentDocs(req): Promise<Response |
null>`, wired into `serve.ts` right after `handleFirmwareApi`:

```ts
const agent = await handleAgentDocs(req);
if (agent) return agent;
```

It handles exactly two things (everything else is already served by the existing
static logic):

1. `/mcp` (POST and GET) -> the MCP handler (Component 5).
2. Canonical doc route with `Accept: text/markdown` (and not already a `.md` or
   an asset) -> read `dist/<route>.md`, return it with
   `Content-Type: text/markdown; charset=utf-8` and `Vary: Accept` (so the
   reverse proxy caches HTML and Markdown variants separately). If the `.md`
   is missing (e.g. a dashboard route), return null and fall through to HTML.

`/<route>.md`, `/llms.txt`, `/llms-full.txt`, `/sitemap.xml`, `/robots.txt`, and
the prerendered `/<route>.html` are all plain files in `dist/` and need no new
code; they are served by the existing exact-file / `.html` fallthrough. One small
fix: ensure `.md` files go out as `text/markdown; charset=utf-8` (set it in the
fallthrough or let `handleAgentDocs` own `.md` responses).

## Component 5: MCP server

New file: `server/mcp.ts`. `mcp-lite` (fetch-native): `new
StreamableHttpTransport().bind(server)` returns `(Request) => Promise<Response>`,
mounted on `/mcp`. Stateless, read-only. Per the MCP 2025-11-25 spec, validate the
`Origin` header (403 on present-and-invalid) to block DNS-rebinding; no session id.

Tools, all pure functions over `dist/agent-index.json` + the `.md` files:

- `list_pages()` -> `[{ path, title, section }]` for every doc page.
- `get_page(path)` -> full Markdown of one page (`Bun.file("dist/" + path +
  ".md").text()`), 404 if missing.
- `search_docs(query, limit?)` -> ranked `[{ path, title, snippet }]` over the
  index (title + section text), simple scoring; no external dep.

Fallback if `mcp-lite` disappoints in testing: `@hono/mcp` (keeps the official
`McpServer`, adds Hono) or the official SDK via a `fetch-to-node` bridge. Decision
stands with `mcp-lite` unless a smoke test fails.

The site advertises the endpoint (Component 7 menu + a line in the docs) since
there is no ratified MCP discovery standard yet.

## Component 6: client-side changes (minimal, additive)

1. Double-mount fix: the prerendered HTML has content inside `#root`; a SPA mounts
   with `render()` (not `hydrate()`), which would append a second copy. Clear
   `#root` before `render()` in `src/index.tsx` (one line:
   `root.textContent = ''`). Result for humans: prerendered content paints first,
   then identical JS content replaces it (negligible flash on a docs page). For
   crawlers/no-JS: the prerendered content stays.
2. Per-route head: add `@solidjs/meta` (works with plain `render()`), wrap the app
   in `<MetaProvider>` (one line in `App.tsx`), and add a single data-driven
   `RouteMeta` component in `DocsLayout` that looks up the current route in the
   route->meta map (same source as `llms.txt`/sitemap) and renders
   `<Title>/<Meta>/<Link rel="canonical">`. Fixes both the prerendered snapshots
   (crawl captures `document.head`) and live client-navigation head. This replaces
   the need for a separate crawl-time head-injection map.

Both changes are small and localised (`index.tsx`, `App.tsx`, one new `RouteMeta`
+ meta-map module, `DocsLayout` mount point). No page `.tsx` content is touched.

## Component 7: human "Copy / View as Markdown / Open in Claude·ChatGPT" menu

A per-page action menu in `DocsLayout` (top-right of the doc content), matching
the Vercel/Mintlify/Fern affordance:

- Copy as Markdown: fetch `/<route>.md`, copy to clipboard.
- View as Markdown: link to `/<route>.md`.
- Open in Claude: `https://claude.ai/new?q=<encoded prompt referencing the .md URL>`.
- Open in ChatGPT: `https://chatgpt.com/?q=<encoded prompt referencing the .md URL>`.
- Optional: a small "Add to your AI tools" hint exposing the `/mcp` URL.

This is the one component that edits `DocsLayout.tsx` substantively, the file most
likely to collide with the other agent's work. It ships from the start (user
decision) but the DocsLayout edit is coordinated and merged carefully (see below).

## Data flow

```
searchIndex.ts ─┬─▶ routes.ts (route list, exclude Home + dashboard)
                ├─▶ route->meta map ─▶ RouteMeta (runtime) + head (prerender)
                └─▶ llms.txt sections + agent-index.json skeleton
vite build ─▶ dist/ ─▶ [crawl] ─▶ dist/<route>.{html,md} ─▶ llms-full.txt,
                                    agent-index.json (text), llms.txt, sitemap.xml
runtime: serve.ts ─▶ handleFirmwareApi ─▶ handleAgentDocs ─▶ static(dist/)
```

## Error handling and edge cases

- Missing `.md` for a route (dashboard, Home): `Accept: text/markdown` falls
  through to HTML; `/route.md` 404s naturally.
- Crawl of a page that throws or never signals ready: fail the build loudly
  (non-zero exit) with the offending route, so a broken page cannot silently ship
  an empty twin.
- `fetchReleases` firing during a dashboard crawl: moot, dashboard is excluded.
- MCP `get_page` with an unknown/traversal path: normalize and allowlist against
  the known route set; 404 otherwise. No filesystem escape.
- Reverse proxy caching: `Vary: Accept` on the negotiated route is required so the
  proxy does not serve HTML to an agent that asked for Markdown or vice versa.

## Testing

Per repo test philosophy (cover logic that hardware/build cannot), unit-test the
pure pieces; smoke-test the wired pieces:

- `htmlToMarkdown`: fixture HTML (one per class-vocabulary pattern) -> asserted
  Markdown. Covers the bare-`<pre>` whitespace, GFM table formation, callout
  prefixes, code-fence language, link rewriting, badge inlining.
- Snapshot a few representative `.md` twins (Clip, Requests, Enums) and diff in CI
  so content drift is visible.
- `llms.txt` / `sitemap.xml` / `robots.txt` shape assertions.
- MCP: in-process smoke test calling `list_pages`, `get_page`, `search_docs`
  against a small `agent-index.json` fixture; assert Origin validation returns 403.
- Content-negotiation: request a route with `Accept: text/markdown` and assert
  `text/markdown` + `Vary: Accept`; request without and assert HTML.
- Prerender determinism: run the crawl twice on the same `dist/`, assert byte
  -identical outputs (no timestamps/ordering nondeterminism).

## CI / build integration

Multi-stage Docker so Playwright/Chromium never touch the runtime image:

1. `builder` (`oven/bun:1-debian`): `bun install --frozen-lockfile`, `bun run
   build` -> `dist/`.
2. `prerender` (`mcr.microsoft.com/playwright:v1.xx-jammy`, has Node + Chromium +
   system deps): copy `dist/` + `scripts/` + the route/meta data, `npm ci` the
   build-only deps (playwright, turndown, turndown-plugin-gfm, sirv), run
   `node scripts/prerender.mjs` (serves `dist/` locally, crawls, writes the
   enriched `dist/`).
3. `runner` (`oven/bun:1-alpine`): copy the enriched `dist/` + `serve.ts` +
   `server/` (now including `agent.ts` + `mcp.ts`), install runtime deps
   (`mcp-lite`), `bun run serve.ts`.

`.github/workflows/ci.yml` gains the prerender stage and the new tests. Multi-arch
build unchanged in shape.

## Coordination with the concurrent agent

Another agent is editing `medius-docs` `feat/box-name` (page `.tsx` content). This
work is almost entirely new files plus small additive edits:

- New: `scripts/prerender.mjs`, `scripts/lib/htmlToMarkdown.ts`, `scripts/routes.ts`,
  `server/agent.ts`, `server/mcp.ts`, `src/app/routeMeta.ts`, `RouteMeta.tsx`,
  tests, `robots.txt` template, Dockerfile prerender stage, CI edits.
- Small edits: `serve.ts` (one call), `src/index.tsx` (one line), `App.tsx`
  (MetaProvider wrap), `DocsLayout.tsx` (RouteMeta mount + the copy menu),
  `package.json` (deps).

To guarantee zero interference, do the work in a dedicated **git worktree** on
branch `feat/agent-docs` cut from the current `feat/box-name` HEAD. That leaves
the other agent's working directory and branch untouched. The only real overlap
risk is `DocsLayout.tsx` and `App.tsx`; land those edits last, rebase onto the
latest `feat/box-name` right before merging, and resolve there. Merge into
`feat/box-name` (or master, per release flow) once the user says the coast is
clear. No release/version bump is part of this design.

## Build order (milestones)

1. Pipeline core: `routes.ts`, `htmlToMarkdown.ts`, `prerender.mjs` -> `.md` +
   `.html` for all routes, with unit tests. (The highest-ROI channel first.)
2. Derived artifacts: `llms.txt`, `llms-full.txt`, `sitemap.xml`, `robots.txt`,
   `agent-index.json`.
3. Server: `handleAgentDocs` (Accept negotiation, `.md` content-type, Vary) +
   `serve.ts` wiring + negotiation tests.
4. MCP: `server/mcp.ts` (`mcp-lite`, three tools, Origin check) + smoke tests +
   advertise the endpoint.
5. Client: `index.tsx` double-mount fix, `@solidjs/meta` + `RouteMeta`, the
   DocsLayout copy menu.
6. CI/Docker: prerender stage, tests in CI, verify a full image build serves all
   four channels.

## Open questions for the plan

- Prerender readiness: add `window.__PRERENDER_READY` to the app, or rely on
  selector + Prism-token waits only? (Lean: selector + Prism check, no app flag,
  to keep the build tool decoupled from app code.)
- `llms.txt` link targets: point at `.md` (agent-first) or the HTML routes
  (human-clickable)? (Lean: `.md`, since the consumers are agents; sitemap covers
  the HTML routes for crawlers.)
- Exact `mcp-lite` version/API surface to pin, verified by a Bun smoke test before
  committing to it over `@hono/mcp`.
