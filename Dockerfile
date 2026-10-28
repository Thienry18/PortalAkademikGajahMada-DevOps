# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev && npm cache clean --force

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
LABEL org.opencontainers.image.source="https://github.com/Thienry18/PortalAkademikGajahMada-DevOps"
ENV NODE_ENV=production PORT=3000 SERVE_FRONTEND=false
COPY --from=dependencies --chown=1000:1000 /app/node_modules ./node_modules
COPY --chown=1000:1000 package.json server.js ./
COPY --chown=1000:1000 src ./src
COPY --chown=1000:1000 database ./database
COPY --chown=1000:1000 docker/backend/start.js ./docker/backend/start.js
RUN mkdir -p uploads && chown node:node uploads
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=6 CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "docker/backend/start.js"]
