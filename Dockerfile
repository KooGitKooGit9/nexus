# syntax=docker/dockerfile:1
# Nexus — production image (API + WebSocket + built SPA in one Node process). See DEPLOY.md.

# ── build: install all deps, build the SPA, then drop dev deps ──
FROM node:22-slim AS build
WORKDIR /app
# toolchain only in case better-sqlite3 has no prebuilt binary for this platform
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# ── runtime ──
FROM node:22-slim
ENV NODE_ENV=production \
    PORT=8080 \
    NEXUS_DATA_DIR=/app/server/data
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server/*.mjs ./server/
COPY --from=build /app/server/docker-entrypoint.sh ./server/
RUN mkdir -p /app/server/data && chown -R node:node /app/server/data && chmod +x /app/server/docker-entrypoint.sh
# SQLite DB + uploaded files live here — mount a persistent volume.
VOLUME /app/server/data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# The entrypoint fixes volume ownership (Fly/Railway mount volumes as root) and drops to the `node` user.
ENTRYPOINT ["/app/server/docker-entrypoint.sh"]
CMD ["node", "server/index.mjs", "--prod"]
