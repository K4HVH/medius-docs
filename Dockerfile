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

# Production stage
FROM oven/bun:1-alpine AS runner

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S bunuser -u 1001

# Copy built files from builder
COPY --from=builder --chown=bunuser:nodejs /app/dist /app/dist

# Copy the native Bun server and the firmware proxy
COPY --chown=bunuser:nodejs serve.ts /app/serve.ts
COPY --chown=bunuser:nodejs server /app/server

USER bunuser

EXPOSE 3000

# Serve with native Bun server
CMD ["bun", "run", "serve.ts"]
