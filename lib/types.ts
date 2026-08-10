export type UUID = string;
export type ArtifactType = "image" | "text";

export interface GridColumnConfig {
  id: string;
  modelId: UUID | null;
  benchmarkId?: UUID | null;
  label?: string;
}

export interface GridViewConfig {
  version: 1;
  columns: GridColumnConfig[];
  benchmarkId?: UUID | null;
  sortBy?: "createdAt" | "filename";
}

export const DEFAULT_GRID_VIEW: GridViewConfig = {
  version: 1,
  columns: [],
  sortBy: "filename"
};

export interface ModelSummary {
  id: UUID;
  name: string;
  slug: string;
  type: ArtifactType;
  description?: string | null;
  createdAt: string;
  benchmarkCount: number;
  imageCount: number;
}

export interface BenchmarkSummary {
  id: UUID;
  name: string;
  slug: string;
  createdAt: string;
  modelCount: number;
  imageCount: number;
}

export interface ImageArtifactDTO {
  id: UUID;
  modelId: UUID;
  modelName?: string | null;
  benchmarkId: UUID;
  filename: string;
  type: ArtifactType;
  prompt?: string | null;
  editInstruction?: string | null;
  sourceUrl?: string | null;
  content?: string | null;
  cacheUrl?: string | null;
  thumbnailUrl?: string | null;
  width?: number | null;
  height?: number | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  capturedAt?: string | null;
}
