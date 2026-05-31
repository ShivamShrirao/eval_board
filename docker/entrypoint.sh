#!/usr/bin/env bash
set -euo pipefail

if [ "${SKIP_PRISMA_MIGRATE:-0}" != "1" ]; then
  echo "[entrypoint] Applying database migrations..."
  pnpm prisma migrate deploy
fi

if [ "${RUN_PRISMA_GENERATE:-0}" = "1" ]; then
  echo "[entrypoint] Regenerating Prisma client..."
  pnpm prisma generate
fi

PORT="${PORT:-8080}"
HOST="${HOST:-0.0.0.0}"

export PORT
export HOSTNAME="$HOST"

exec pnpm exec next start
