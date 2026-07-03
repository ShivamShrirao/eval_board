CREATE TYPE "ArtifactType" AS ENUM ('image', 'text');

ALTER TABLE "Model"
  ADD COLUMN "type" "ArtifactType" NOT NULL DEFAULT 'image';

ALTER TABLE "ImageArtifact"
  ADD COLUMN "type" "ArtifactType" NOT NULL DEFAULT 'image',
  ADD COLUMN "content" TEXT;

ALTER TABLE "ImageArtifact"
  ALTER COLUMN "sourceUrl" DROP NOT NULL;
