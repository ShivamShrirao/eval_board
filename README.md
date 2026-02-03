# Eval Board

Visual dashboard for comparing diffusion model checkpoints across datasets.

## Project Structure
- `app/` – Next.js App Router pages and layouts.
- `components/` – React component library (grid, view context, etc.).
- `lib/` – Shared utilities, Prisma client, server-side services, validation schemas.
- `prisma/` – Database schema and migrations.
- `docs/` – Architecture and setup guides.
- `ref_script/` – Legacy scripts for discovering S3 image layouts (reference only).

## Quick Start (Docker)
1. Copy `.env.example` to `.env` and set `DATABASE_URL=postgresql://postgres:postgres@postgres:5432/eval_board`.
2. Build & start the stack: `docker compose -f docker-compose.dev.yml up -d --build`.
3. The web container runs Prisma migrations automatically on boot; once healthy, open http://localhost:3000.
   - Rebuild after code changes with `docker compose -f docker-compose.dev.yml up -d --build web`.

Detailed setup instructions and architecture notes live in `docs/setup.md` and `docs/architecture.md`.
