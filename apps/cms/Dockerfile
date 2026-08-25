FROM node:24-bookworm-slim AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-bookworm-slim AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS migrator

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

RUN groupadd --gid 10001 payload \
    && useradd --uid 10001 --gid payload --create-home --shell /usr/sbin/nologin payload

WORKDIR /app

COPY --from=deps --chown=payload:payload /app/node_modules ./node_modules
COPY --chown=payload:payload package.json package-lock.json next.config.mjs tsconfig.json ./
COPY --chown=payload:payload src ./src

USER payload

CMD ["npm", "run", "migrate"]

FROM node:24-bookworm-slim AS runner

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3001

RUN groupadd --gid 10001 payload \
    && useradd --uid 10001 --gid payload --create-home --shell /usr/sbin/nologin payload

WORKDIR /app

COPY --from=builder --chown=payload:payload /app/.next/standalone ./
COPY --from=builder --chown=payload:payload /app/.next/static ./.next/static
COPY --from=deps --chown=payload:payload /app/node_modules/@img/sharp-libvips-linux-x64/lib /app/node_modules/@img/sharp-libvips-linux-x64/lib
RUN mkdir -p /app/uploads /app/.next/cache \
    && chown -R payload:payload /app/uploads /app/.next/cache

USER payload

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:3001/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
