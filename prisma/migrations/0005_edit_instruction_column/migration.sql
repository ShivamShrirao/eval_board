-- Promote the edit instruction to a first-class column, unifying the two legacy
-- metadata keys (`edit_instruction` and the older `instruction`) and removing
-- both from metadata. Where both exist they are identical, so COALESCE is lossless.

ALTER TABLE "ImageArtifact" ADD COLUMN "editInstruction" TEXT;

-- Backfill from metadata: prefer `edit_instruction`, fall back to `instruction`.
UPDATE "ImageArtifact"
SET "editInstruction" = COALESCE(metadata->>'edit_instruction', metadata->>'instruction')
WHERE metadata ? 'edit_instruction' OR metadata ? 'instruction';

-- Strip both legacy keys from metadata. The `-` operator removes only the exact
-- top-level keys, so scorer sub-fields like `compass_arm6_instruction` are untouched.
UPDATE "ImageArtifact"
SET metadata = (metadata - 'edit_instruction' - 'instruction')
WHERE metadata ? 'edit_instruction' OR metadata ? 'instruction';
