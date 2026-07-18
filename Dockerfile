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

RUN node_modules/.bin/tsx scripts/prerender.ts

# Stage 3: production runtime — the Bun server serving the enriched dist/.
FROM oven/bun:1-alpine AS runner

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S bunuser -u 1001

# Copy the enriched dist/ (SPA + prerendered .html/.md + agent artifacts).
COPY --from=prerender --chown=bunuser:nodejs /app/dist /app/dist

# Copy the Bun server, its handlers, and the one runtime dependency (mcp-lite).
COPY --from=builder --chown=bunuser:nodejs /app/serve.ts /app/serve.ts
COPY --from=builder --chown=bunuser:nodejs /app/server /app/server
COPY --from=builder --chown=bunuser:nodejs /app/node_modules/mcp-lite /app/node_modules/mcp-lite

USER bunuser

EXPOSE 3000

# Serve with native Bun server
CMD ["bun", "run", "serve.ts"]
