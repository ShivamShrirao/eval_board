import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { removeCachedFiles } from "./image-cache";

export interface IngestModelInput {
  name: string;
  slug?: string | null;
  description?: string | null;
}

export interface IngestDatasetInput {
  name: string;
  slug?: string | null;
}

export interface IngestImageInput {
  filename: string;
  sourceUrl: string;
  prompt?: string | null;
  thumbnailUrl?: string | null;
  width?: number | null;
  height?: number | null;
  metadata?: Record<string, unknown> | null;
  capturedAt?: string | Date | null;
}

export interface IngestPayload {
  model: IngestModelInput;
  dataset: IngestDatasetInput;
  images: IngestImageInput[];
}

export interface IngestResult {
  modelId: string;
  datasetId: string;
  count: number;
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

export async function ingestPayload(payload: IngestPayload): Promise<IngestResult> {
  const model = await prisma.model.upsert({
    where: { name: payload.model.name },
    create: {
      name: payload.model.name,
      slug: payload.model.slug ?? slugify(payload.model.name),
      description: payload.model.description ?? null
    },
    update: {
      slug: payload.model.slug ?? undefined,
      description: payload.model.description ?? undefined
    }
  });

  const dataset = await prisma.dataset.upsert({
    where: { name: payload.dataset.name },
    create: {
      name: payload.dataset.name,
      slug: payload.dataset.slug ?? slugify(payload.dataset.name)
    },
    update: {
      slug: payload.dataset.slug ?? undefined
    }
  });

  if (!payload.images.length) {
    return { modelId: model.id, datasetId: dataset.id, count: 0 };
  }

  const operations = payload.images.map((image) =>
    prisma.imageArtifact.upsert({
      where: {
        modelId_datasetId_filename: {
          modelId: model.id,
          datasetId: dataset.id,
          filename: image.filename
        }
      },
      create: {
        modelId: model.id,
        datasetId: dataset.id,
        filename: image.filename,
        sourceUrl: image.sourceUrl,
        prompt: image.prompt ?? null,
        promptHash: image.prompt ? slugify(image.prompt) : null,
        thumbnailUrl: image.thumbnailUrl ?? null,
        width: image.width ?? null,
        height: image.height ?? null,
        metadata: normalizeMetadata(image.metadata),
        capturedAt: normalizeCapturedAt(image.capturedAt)
      },
      update: {
        sourceUrl: image.sourceUrl,
        prompt: image.prompt ?? null,
        promptHash: image.prompt ? slugify(image.prompt) : null,
        thumbnailUrl: image.thumbnailUrl ?? null,
        width: image.width ?? null,
        height: image.height ?? null,
        metadata: normalizeMetadata(image.metadata),
        capturedAt: normalizeCapturedAt(image.capturedAt),
        updatedAt: new Date()
      }
    })
  );

  const result = await prisma.$transaction(operations);

  // Invalidate any stale local cache entries; warming happens lazily on the
  // next read via the cache route.
  await removeCachedFiles(result.map((artifact) => artifact.id));

  return { modelId: model.id, datasetId: dataset.id, count: result.length };
}

const normalizeCapturedAt = (value: string | Date | null | undefined): Date | null => {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeMetadata = (
  value: Record<string, unknown> | null | undefined
): Prisma.InputJsonValue | undefined =>
  value && Object.keys(value).length ? (value as Prisma.InputJsonValue) : undefined;
