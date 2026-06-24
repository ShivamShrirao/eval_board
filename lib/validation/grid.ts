import { z } from "zod";

export const gridColumnSchema = z.object({
  id: z.string(),
  modelId: z.string().uuid().nullable(),
  datasetId: z.string().uuid().nullable().optional(),
  label: z.string().optional()
});

export const gridConfigSchema = z.object({
  version: z.literal(1),
  columns: z.array(gridColumnSchema).max(12),
  datasetId: z.string().uuid().nullable().optional(),
  sortBy: z.enum(["createdAt", "filename"]).optional()
});
