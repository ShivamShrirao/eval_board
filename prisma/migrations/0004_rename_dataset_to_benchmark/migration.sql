-- Rename Dataset -> Benchmark across the schema, preserving all existing data.

-- 1. Rename the table and its owned constraint/indexes.
ALTER TABLE "Dataset" RENAME TO "Benchmark";
ALTER TABLE "Benchmark" RENAME CONSTRAINT "Dataset_pkey" TO "Benchmark_pkey";
ALTER INDEX "Dataset_name_key" RENAME TO "Benchmark_name_key";
ALTER INDEX "Dataset_slug_key" RENAME TO "Benchmark_slug_key";
ALTER INDEX "Dataset_createdAt_idx" RENAME TO "Benchmark_createdAt_idx";

-- 2. Rename the foreign key column on ImageArtifact (indexes/FK follow the column
--    automatically in their definitions, but their names must be renamed too).
ALTER TABLE "ImageArtifact" RENAME COLUMN "datasetId" TO "benchmarkId";
ALTER TABLE "ImageArtifact"
  RENAME CONSTRAINT "ImageArtifact_datasetId_fkey" TO "ImageArtifact_benchmarkId_fkey";

ALTER INDEX "ImageArtifact_modelId_datasetId_filename_key"
  RENAME TO "ImageArtifact_modelId_benchmarkId_filename_key";
ALTER INDEX "ImageArtifact_modelId_datasetId_idx"
  RENAME TO "ImageArtifact_modelId_benchmarkId_idx";
ALTER INDEX "ImageArtifact_datasetId_createdAt_idx"
  RENAME TO "ImageArtifact_benchmarkId_createdAt_idx";
-- ImageArtifact_grid_filename_idx and ImageArtifact_grid_createdAt_idx keep their
-- names in the Prisma schema, so they are intentionally left unrenamed.

-- 3. Migrate persisted grid view configs: the `datasetId` JSON key (top-level and
--    per-column) becomes `benchmarkId`. A quoted-key text replace is safe here
--    because values are UUIDs, never the literal string "datasetId".
UPDATE "ViewKV"
SET value = replace(value::text, '"datasetId"', '"benchmarkId"')::jsonb
WHERE value::text LIKE '%"datasetId"%';
