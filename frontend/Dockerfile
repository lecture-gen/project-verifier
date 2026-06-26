# syntax=docker/dockerfile:1.7
# Next.js 16 (standalone output) 컨테이너 이미지.

ARG NODE_VERSION=22-alpine

FROM node:${NODE_VERSION} AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:${NODE_VERSION} AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# next build 는 NEXT_PUBLIC_* 환경변수를 컴파일타임에 인라인할 수 있다.
# docker compose 의 build.args 로 주입해 client bundle 에 정확한 API URL 이 박히도록 한다.
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
RUN pnpm build

FROM node:${NODE_VERSION} AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nextjs \
    && adduser --system --uid 1001 --ingroup nextjs nextjs

COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nextjs /app/public ./public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=5 \
    CMD wget -qO- http://127.0.0.1:3000/ >/dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
