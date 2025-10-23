export type UUID = string;

export interface GridColumnConfig {
  id: string;
  modelId: UUID;
  datasetId?: UUID | null;
  label?: string;
}

export interface GridViewConfig {
  version: 1;
  columns: GridColumnConfig[];
  datasetId?: UUID | null;
  breakdownBy?: "filename" | "prompt";
  sortBy?: "createdAt" | "filename";
}

export const DEFAULT_GRID_VIEW: GridViewConfig = {
  version: 1,
  columns: [],
  breakdownBy: "filename",
  sortBy: "filename"
};

export interface ModelSummary {
  id: UUID;
  name: string;
  slug: string;
  description?: string | null;
  createdAt: string;
  datasetCount: number;
  imageCount: number;
}

export interface DatasetSummary {
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
  datasetId: UUID;
  filename: string;
  prompt?: string | null;
  sourceUrl: string;
  thumbnailUrl?: string | null;
  width?: number | null;
  height?: number | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  capturedAt?: string | null;
}
