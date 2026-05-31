# syntax=docker/dockerfile:1.6

FROM node:20-bullseye-slim AS deps

ENV NODE_ENV=development \
    NEXT_TELEMETRY_DISABLED=1 \
    PNPM_HOME=/usr/local/share/pnpm \
    PATH=/usr/local/share/pnpm:$PATH

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.19.0 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install

FROM node:20-bullseye-slim AS builder

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PNPM_HOME=/usr/local/share/pnpm \
    PATH=/usr/local/share/pnpm:$PATH

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.19.0 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm prisma generate

COPY . .

RUN pnpm build

FROM node:20-bullseye-slim AS runner

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PNPM_HOME=/usr/local/share/pnpm \
    PATH=/usr/local/share/pnpm:$PATH

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.19.0 --activate

COPY --from=builder /app /app

RUN chmod +x docker/entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["./docker/entrypoint.sh"]
