# Eval Board Dashboard – Architecture Outline

## Requirements Recap
- Visual comparison dashboard for diffusion model outputs; data already on S3.
- Models × Datasets matrix; grid columns per model, global dataset filter, per-row alignment by filename/prompt.
- Shareable URLs for saved grid configurations.
- Expand image modal with metadata + arrow-key navigation.
- Lazy loading/virtualization for performance.
- Backend on Node.js (Next.js) with PostgreSQL; Python package to ingest metadata.
- Future: SSO (Google Workspace) but not in initial scope.

## Data Model (PostgreSQL via Prisma)
- `Model`: id (uuid), name (unique), slug, description, created_at.
- `Dataset`: id (uuid), name (unique), slug, created_at.
- `ImageArtifact`: id (uuid), model_id FK, dataset_id FK, source_url, prompt, prompt_hash, filename, dimensions, metadata JSONB, captured_at, created_at. Unique index on (model_id, dataset_id, filename) to align rows.
- `ViewKV`: context (text), key (text), value (jsonb), created_at, updated_at. Composite PK `(context, key)`.
- `ModelTag` (optional, for future filters), `DatasetTag` possible extension.
- Audit: automatic `created_at`/`updated_at` via triggers or Prisma defaults.

## Backend/API Plan
- Framework: Next.js 14 (app router). API routes under `app/api`.
- Data access through Prisma Client.
- Routes:
  - `GET /api/models?search=&limit=...` → latest-first list, includes dataset counts.
  - `GET /api/datasets?search=...` → latest-first list.
  - `GET /api/images?modelIds=&datasetId=&cursor=&take=` → paginated artifacts for selected columns.
  - `POST /api/ingest` → called by Python package; payload includes model, dataset, images array. Idempotent on (model, dataset, filename); upsert metadata.
  - `GET /api/view?id=` → returns stored grid config JSON.
  - `POST /api/view` → {context:"grid", key, value}. Upsert with updated timestamp.
- Edge caching: set cache headers for read endpoints; revalidate on mutate.
- Validation with Zod; error responses in JSON with codes.

## Python Package (Installable via pip/uv)
- Package name `eval_board_client`.
- Provides:
  - `Client` class (configurable base_url, API key/token stub).
  - `register_view(model_name, dataset_name, images: List[ImageSpec])`.
  - CLI: `eval-board ingest --model <name> --dataset <name> --from-s3 s3://... --config config.yml`.
- Integrates with boto3 to resolve S3 URLs similar to reference scripts; extracts metadata (prompt, dims) from JSON or filename patterns.
- Packaging: `pyproject.toml` (PEP 621), CLI via `typer`/`click`.
- Tests via `pytest`; publishes to private index later (placeholder docs).

## Frontend Architecture
- Next.js app router with TypeScript + Tailwind + Radix UI components.
- Global context `ViewContext` storing current grid spec (models array, dataset filter, sort order).
- Data fetching hooks built on SWR (or React Query) hitting API routes; search inputs debounced.
- Grid implemented with virtualization (`react-virtualized` or `react-window`) to render rows lazily; column virtualization optional.
- Column state: ability to add/remove/reorder (drag-and-drop via `@dnd-kit`).
- Image cards lazy load with `next/image` or vanilla `<img>` + `loading="lazy"`.
- Keyboard navigation in modal via `useHotkeys`; metadata panel uses Radix Dialog/Sheet.
- URL syncing:
  - Serialize grid spec deterministically (stable stringify + canonical key ordering).
  - Maintain local cache of `viewId` by spec; reuse ID when revisiting.
  - On change, POST to `/api/view`, then update router query `?view=<id>` with shallow push.
- SSR handler reads `view` query, fetches config, preloads data for initial render.

## Performance Considerations
- Apply indexes on `(model_id, dataset_id, filename)` and `created_at` fields.
- Paginate image fetches per column, merge on client aligning by filename/prompt key.
- Use IntersectionObserver to prefetch upcoming rows.
- Serve optimized CDN URLs from S3 (signed or presigned configurable); keep metadata fetch lightweight.

## Developer Experience & Tooling
- Package manager: `pnpm` (fallback to npm via scripts).
- Code formatting: `prettier`, `eslint`, `typescript` strict mode.
- Testing: Jest/React Testing Library for UI, Playwright smoke tests optional, integration tests hitting local Postgres (via Prisma test schema).
- Env config: `.env` with `DATABASE_URL`, `S3_BASE_URL`, `API_BASE_URL`, etc. Provide `.env.example`.
- Scripts: `pnpm dev`, `pnpm lint`, `pnpm test`, `pnpm migrate`.
- Postgres setup doc (Docker Compose or local instructions).

## Open Questions / Future Enhancements
- Auth/SSO integration timeline & provider specifics.
- Multi-tenant or per-team visibility?
- Versioning for model checkpoints beyond textual name (dates? semantic versions?).
- Need for prompt grouping/filters beyond datasets?
- Audit logging / change history requirements.
- Access to private S3 (signed URLs) vs public bucket.
- Should ingestion support incremental updates or deletions?

## Next Steps
1. Scaffold Next.js + Prisma project, configure gitignore.
2. Define Prisma schema + migrations.
3. Implement API routes + frontend components iteratively.
4. Build Python package and integration tests.
5. Document setup/run instructions and future auth hooks.
