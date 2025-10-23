-- Create the pgcrypto extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Model table
CREATE TABLE "Model" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "Model_name_key" ON "Model"("name");
CREATE UNIQUE INDEX "Model_slug_key" ON "Model"("slug");
CREATE INDEX "Model_createdAt_idx" ON "Model"("createdAt");

-- Dataset table
CREATE TABLE "Dataset" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "Dataset_name_key" ON "Dataset"("name");
CREATE UNIQUE INDEX "Dataset_slug_key" ON "Dataset"("slug");
CREATE INDEX "Dataset_createdAt_idx" ON "Dataset"("createdAt");

-- ImageArtifact table
CREATE TABLE "ImageArtifact" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "modelId" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "prompt" TEXT,
    "promptHash" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "metadata" JSONB,
    "capturedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "ImageArtifact_modelId_datasetId_filename_key"
  ON "ImageArtifact"("modelId", "datasetId", "filename");
CREATE INDEX "ImageArtifact_modelId_datasetId_idx"
  ON "ImageArtifact"("modelId", "datasetId");
CREATE INDEX "ImageArtifact_datasetId_createdAt_idx"
  ON "ImageArtifact"("datasetId", "createdAt");
CREATE INDEX "ImageArtifact_promptHash_idx"
  ON "ImageArtifact"("promptHash");

ALTER TABLE "ImageArtifact"
  ADD CONSTRAINT "ImageArtifact_modelId_fkey"
  FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImageArtifact"
  ADD CONSTRAINT "ImageArtifact_datasetId_fkey"
  FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ViewKV table
CREATE TABLE "ViewKV" (
    "context" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ViewKV_pkey" PRIMARY KEY ("context", "key")
);
