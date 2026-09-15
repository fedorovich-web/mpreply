FROM node:24-bookworm-slim AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-bookworm-slim AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

ARG NEXT_PUBLIC_SITE_URL=https://respio.ru
ARG NEXT_PUBLIC_CONTACT_EMAIL=
ARG NEXT_PUBLIC_API_BASE_URL
ARG DEPLOYMENT_VERSION=local

ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_CONTACT_EMAIL=$NEXT_PUBLIC_CONTACT_EMAIL \
    NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    DEPLOYMENT_VERSION=$DEPLOYMENT_VERSION

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN node -e "const value=process.env.NEXT_PUBLIC_API_BASE_URL; if (!value) throw new Error('NEXT_PUBLIC_API_BASE_URL build argument is required')" \
    && npm run build

FROM node:24-bookworm-slim AS runner

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN groupadd --gid 10001 nodejs \
    && useradd --uid 10001 --gid nodejs --create-home --shell /usr/sbin/nologin nextjs

WORKDIR /app

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:3000/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
