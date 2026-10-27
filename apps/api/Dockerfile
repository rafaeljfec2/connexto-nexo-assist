FROM node:24.22.1-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.12.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/domain/package.json ./packages/domain/
COPY packages/contracts/package.json ./packages/contracts/
# ignore-scripts avoids native postinstall PATH failures in Alpine when unused.
RUN pnpm install --frozen-lockfile --filter @nexo-assist/api... --ignore-scripts

FROM base AS builder
COPY --from=deps /app .
COPY . .
RUN pnpm --filter @nexo-assist/contracts build \
  && pnpm --filter @nexo-assist/domain build \
  && pnpm --filter @nexo-assist/api build
RUN pnpm deploy --filter @nexo-assist/api --prod --legacy /app/deployed \
  && test -f /app/deployed/dist/main.js
COPY apps/api/src/db/migrations /app/deployed/dist/db/migrations
COPY apps/api/docker-entrypoint.sh /app/deployed/docker-entrypoint.sh


FROM node:24.22.1-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder --chown=app:app /app/deployed .
RUN chmod +x ./docker-entrypoint.sh
USER app
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=12 \
  CMD node -e "fetch('http://127.0.0.1:3001/health/live').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["./docker-entrypoint.sh"]
