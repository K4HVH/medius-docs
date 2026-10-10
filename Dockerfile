# Stage 1: build the SPA with Bun.
FROM oven/bun:1-debian AS builder

WORKDIR /app

# Copy dependency files
COPY package.json bun.lock* ./

# Install dependencies with cache mount
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the application with cache mount
RUN --mount=type=cache,target=/app/node_modules/.vite \
    bun run build

# Stage 2: prerender the built SPA into per-route static HTML + Markdown twins and
# the agent artifacts (llms.txt, sitemap.xml, robots.txt, agent-index.json). Runs
# under Node with a real Chromium; the image tag MUST match the installed
# playwright package version (see package.json devDependencies).
FROM mcr.microsoft.com/playwright:v1.61.1-jammy AS prerender

WORKDIR /app

# Bring over the built app plus its node_modules (tsx, sirv, turndown, playwright).
COPY --from=builder /app /app

ENV SITE_ORIGIN=https://medius.k4tech.net

RUN node_modules/.bin/tsx scripts/prerender.ts && node_modules/.bin/tsx scripts/searchindex.ts

# Stage 3: production runtime, the Bun server serving the enriched dist/.
FROM oven/bun:1-alpine AS runner

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S bunuser -u 1001

# The stats database's directory. A new named volume mounted here takes this owner, so the server can
# write to it.
RUN mkdir -p /app/data && chown bunuser:nodejs /app/data
ENV STATS_DB=/app/data/stats.db

# Copy the enriched dist/ (SPA + prerendered .html/.md + agent artifacts).
COPY --from=prerender --chown=bunuser:nodejs /app/dist /app/dist

# Copy the Bun server, its handlers, the app modules it shares with the client, and the runtime
# dependencies (mcp-lite; resvg and opentype.js draw the link cards). tests/unit/runner-image.test.ts
# fails when serve.ts loads anything else.
COPY --from=builder --chown=bunuser:nodejs /app/serve.ts /app/serve.ts
COPY --from=builder --chown=bunuser:nodejs /app/server /app/server
COPY --from=builder --chown=bunuser:nodejs /app/src/app/site.ts /app/src/app/site.ts
COPY --from=builder --chown=bunuser:nodejs /app/src/app/routes.ts /app/src/app/routes.ts
COPY --from=builder --chown=bunuser:nodejs /app/src/app/items.ts /app/src/app/items.ts
COPY --from=builder --chown=bunuser:nodejs /app/src/app/served.ts /app/src/app/served.ts
COPY --from=builder --chown=bunuser:nodejs /app/src/app/card /app/src/app/card
COPY --from=builder --chown=bunuser:nodejs /app/src/app/data/help.ts /app/src/app/data/help.ts
COPY --from=builder --chown=bunuser:nodejs /app/src/dashboard/firmware/notes.ts /app/src/dashboard/firmware/notes.ts
COPY --from=builder --chown=bunuser:nodejs /app/src/app/data/compatibility.ts /app/src/app/data/compatibility.ts
COPY --from=builder --chown=bunuser:nodejs /app/src/app/data/compatMerge.ts /app/src/app/data/compatMerge.ts
COPY --from=builder --chown=bunuser:nodejs /app/src/app/data/homeFigures.ts /app/src/app/data/homeFigures.ts
COPY --from=builder --chown=bunuser:nodejs /app/src/app/search /app/src/app/search
COPY --from=builder --chown=bunuser:nodejs /app/node_modules/mcp-lite /app/node_modules/mcp-lite
COPY --from=builder --chown=bunuser:nodejs /app/node_modules/@resvg /app/node_modules/@resvg
COPY --from=builder --chown=bunuser:nodejs /app/node_modules/opentype.js /app/node_modules/opentype.js

USER bunuser

EXPOSE 3000

# Serve with native Bun server
CMD ["bun", "run", "serve.ts"]
