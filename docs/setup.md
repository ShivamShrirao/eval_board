# Eval Board – Developer Setup

## Primary Workflow: Docker-First

Everything (Next.js app + PostgreSQL) runs inside containers. Your host needs only Docker & Docker Compose (Docker Desktop or the Docker Engine 20+ CLI).

### 1. Environment Variables
Copy `.env.example` to `.env` and fill in secrets. When using Docker, set:

```
DATABASE_URL="postgresql://postgres:postgres@postgres:5432/eval_board"
NEXT_PUBLIC_API_BASE_URL="http://localhost:8080"
```

Any other values (e.g. `NEXT_PUBLIC_S3_PUBLIC_BASE`) can stay empty until needed.

For private S3 assets ingested as `s3://bucket/key`, use your AWS CLI profile instead of hardcoding temporary session tokens in `.env`:

```bash
aws sso login --profile <your-profile>
```

- Set `AWS_PROFILE` in `.env` (for example `AWS_PROFILE=default`).
- `docker-compose.dev.yml` mounts `~/.aws` into the web container and sets `AWS_SDK_LOAD_CONFIG=1`, so the Node AWS SDK resolves credentials from your shared CLI config/cache.
- The API generates presigned URLs server-side on read and caches them in-memory (`S3_PRESIGN_CACHE_REFRESH_WINDOW_SECONDS`, `S3_PRESIGN_CACHE_MAX_ENTRIES`) to keep scrolling fast.
- When the SSO session expires, re-run `aws sso login --profile <your-profile>` on the host; no `.env` token edits needed.

### 2. Build & Start Containers
```bash
docker compose -f docker-compose.dev.yml up -d --build
```
- Web UI: http://localhost:8080
- Postgres: exposed on localhost:5432 (for external DB tools)
- Rebuild after code changes: `docker compose -f docker-compose.dev.yml build web`

Tail the logs:
```bash
docker compose -f docker-compose.dev.yml logs -f web
```

### 3. Database Migrations & Prisma
The container entrypoint runs `pnpm prisma migrate deploy` on every boot. If you need to re-run migrations manually (for example after editing `schema.prisma`), use:
```bash
docker compose -f docker-compose.dev.yml exec web pnpm prisma migrate deploy
```

Regenerate the Prisma client if you modify the schema and want codegen without restarting the container:
```bash
docker compose -f docker-compose.dev.yml exec web pnpm prisma generate
```

Access Prisma Studio:
```bash
docker compose -f docker-compose.dev.yml exec -it web pnpm prisma studio --browser none
```
Then open the printed URL in your host browser.

### 4. Stopping & Resetting
- Stop containers: `docker compose -f docker-compose.dev.yml down`
- Stop & remove volumes (fresh Postgres data): `docker compose -f docker-compose.dev.yml down -v`

### 5. Common Commands (executed inside the web container)
```bash
docker compose -f docker-compose.dev.yml exec web pnpm lint
docker compose -f docker-compose.dev.yml exec web pnpm test
docker compose -f docker-compose.dev.yml exec web pnpm build
docker compose -f docker-compose.dev.yml restart web
```

## Optional: Native Node Workflow
If you still want to run outside Docker, ensure:
- Node.js ≥ 18.18 with pnpm ≥ 10.19 (`corepack prepare pnpm@10.19.0 --activate`)
- PostgreSQL ≥ 14 available locally

Then follow the traditional steps:
```bash
pnpm install
pnpm approve-builds --all
pnpm prisma migrate dev --name init
pnpm dev
```

## Python Package Workflow (Preview)
- Located under `python/`; install with `uv pip install ./python` or `pip install ./python`.
- CLI usage happens via Docker too: `docker compose exec web eval-board ingest ...` once the API routes are live.

## Future Auth Hooks
- Google Workspace SSO will plug into NextAuth or custom SAML later.
- Placeholder env vars for `AUTH_GOOGLE_*` exist in `.env.example`.

## Major Version Notes
- Next.js 16 runs on React 19; ensure third-party libraries advertise React 19 support.
- Tailwind CSS 4 ships PostCSS integration via `@tailwindcss/postcss`; our `postcss.config.js` already uses the new plugin.
- Prisma 6 uses native engines; if install scripts are skipped, rerun `pnpm approve-builds --all` inside the container.

## Troubleshooting
- `docker compose ... exec web pnpm prisma migrate status` verifies migration state.
- If dependencies go missing, clear volumes: `docker compose -f docker-compose.dev.yml down -v && docker compose -f docker-compose.dev.yml up -d --build`.
- For SSL Postgres connections to remote DBs, append `?sslmode=require` to `DATABASE_URL`.
