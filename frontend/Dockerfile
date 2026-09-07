# syntax=docker/dockerfile:1
#
# Next.js "standalone" image for Cloud Run (The Nutty Professor web app).
# Adapted from the natura storefront image. Debian slim (glibc) so Tailwind v4's
# @tailwindcss/oxide native/wasm deps resolve without musl workarounds.

FROM node:24-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1

# ── deps ─────────────────────────────────────────────────────────────────────
# `npm install` (not `npm ci`): a macOS-generated lockfile can't hold the
# Linux-only @emnapi wasm-fallback deps of @tailwindcss/oxide (Tailwind v4),
# so `npm ci` fails on the Linux build. `npm install` resolves them here.
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install

# ── builder ──────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* is inlined at build time. The voice /live WebSocket is opened
# browser->backend directly, so the backend's public wss:// URL must be baked in
# here. Override per environment with --build-arg (the deploy workflow derives it
# from the backend's Cloud Run URL). The localhost default keeps a bare build
# working; server-side calls (/chat, /tts, /stt) use the runtime BACKEND_URL env
# instead, so they are NOT baked here.
ARG NEXT_PUBLIC_LIVE_WS_URL=ws://localhost:8000/live
ENV NEXT_PUBLIC_LIVE_WS_URL=$NEXT_PUBLIC_LIVE_WS_URL
RUN npm run build

# ── runner ───────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
