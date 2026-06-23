CREATE INDEX "ImageArtifact_grid_filename_idx"
  ON "ImageArtifact"("datasetId", "filename", "modelId", "createdAt" DESC, "id");

CREATE INDEX "ImageArtifact_grid_createdAt_idx"
  ON "ImageArtifact"("datasetId", "createdAt" DESC, "modelId", "filename", "id");
