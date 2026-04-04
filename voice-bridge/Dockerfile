# ── Multi-stage build ────────────────────────────────────────────────────────
# Stage 1: build TypeScript → JavaScript
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# ── Stage 2: production image ────────────────────────────────────────────────
FROM node:20-slim AS runner

# Install ca-certificates for HTTPS/WSS outbound connections
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy production deps and compiled output only
COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Expose the HTTP port (set in .env / Coolify env vars)
EXPOSE 3001

# Run as non-root for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs bridge

USER bridge

CMD ["node", "dist/index.js"]
