import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { removeCachedFiles } from "./image-cache";

type ArtifactType = "image" | "text";

export interface IngestModelInput {
  name: string;
  slug?: string | null;
  type?: ArtifactType | null;
  description?: string | null;
}

export interface IngestBenchmarkInput {
  name: string;
  slug?: string | null;
}

export interface IngestImageInput {
  filename: string;
  type?: ArtifactType | null;
  sourceUrl?: string | null;
  content?: string | null;
  prompt?: string | null;
  editInstruction?: string | null;
  thumbnailUrl?: string | null;
  width?: number | null;
  height?: number | null;
  metadata?: Record<string, unknown> | null;
  capturedAt?: string | Date | null;
}

export interface IngestPayload {
  model: IngestModelInput;
  benchmark: IngestBenchmarkInput;
  images: IngestImageInput[];
}

export interface IngestResult {
  modelId: string;
  benchmarkId: string;
  count: number;
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

export async function ingestPayload(payload: IngestPayload): Promise<IngestResult> {
  const modelType = payload.model.type ?? inferModelType(payload.images);
  const model = await prisma.model.upsert({
    where: { name: payload.model.name },
    create: {
      name: payload.model.name,
      slug: payload.model.slug ?? slugify(payload.model.name),
      type: modelType,
      description: payload.model.description ?? null
    },
    update: {
      slug: payload.model.slug ?? undefined,
      type: payload.model.type ?? (modelType === "text" ? "text" : undefined),
      description: payload.model.description ?? undefined
    }
  });

  const benchmark = await prisma.benchmark.upsert({
    where: { name: payload.benchmark.name },
    create: {
      name: payload.benchmark.name,
      slug: payload.benchmark.slug ?? slugify(payload.benchmark.name)
    },
    update: {
      slug: payload.benchmark.slug ?? undefined
    }
  });

  if (!payload.images.length) {
    return { modelId: model.id, benchmarkId: benchmark.id, count: 0 };
  }

  const operations = payload.images.map((image) => {
    const type = image.type ?? modelType;
    // Edit instruction is a first-class column. Accept it explicitly, but also
    // lift it out of legacy metadata keys (`edit_instruction`/`instruction`) and
    // strip them so metadata stays deduped and consistent with older rows.
    const { editInstruction, metadata } = extractEditInstruction(image);
    return prisma.imageArtifact.upsert({
      where: {
        modelId_benchmarkId_filename: {
          modelId: model.id,
          benchmarkId: benchmark.id,
          filename: image.filename
        }
      },
      create: {
        modelId: model.id,
        benchmarkId: benchmark.id,
        filename: image.filename,
        type,
        sourceUrl: image.sourceUrl ?? null,
        content: image.content ?? null,
        prompt: image.prompt ?? null,
        editInstruction,
        promptHash: image.prompt ? slugify(image.prompt) : null,
        thumbnailUrl: image.thumbnailUrl ?? null,
        width: image.width ?? null,
        height: image.height ?? null,
        metadata: normalizeMetadata(metadata),
        capturedAt: normalizeCapturedAt(image.capturedAt)
      },
      update: {
        type,
        sourceUrl: image.sourceUrl ?? null,
        content: image.content ?? null,
        prompt: image.prompt ?? null,
        editInstruction,
        promptHash: image.prompt ? slugify(image.prompt) : null,
        thumbnailUrl: image.thumbnailUrl ?? null,
        width: image.width ?? null,
        height: image.height ?? null,
        metadata: normalizeMetadata(metadata),
        capturedAt: normalizeCapturedAt(image.capturedAt),
        updatedAt: new Date()
      }
    });
  });

  const result = await prisma.$transaction(operations);

  // Invalidate any stale local cache entries; warming happens lazily on the
  // next read via the cache route.
  await removeCachedFiles(result.map((artifact) => artifact.id));

  return { modelId: model.id, benchmarkId: benchmark.id, count: result.length };
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

// Resolve the edit instruction (explicit field wins, then legacy metadata keys)
// and return metadata with those legacy keys removed so nothing is duplicated.
const extractEditInstruction = (
  image: IngestImageInput
): { editInstruction: string | null; metadata: Record<string, unknown> | null } => {
  const metadata = image.metadata ? { ...image.metadata } : null;
  const fromMetadata =
    metadata && typeof metadata.edit_instruction === "string"
      ? metadata.edit_instruction
      : metadata && typeof metadata.instruction === "string"
        ? metadata.instruction
        : null;

  if (metadata) {
    delete metadata.edit_instruction;
    delete metadata.instruction;
  }

  return {
    editInstruction: image.editInstruction ?? fromMetadata,
    metadata
  };
};

const inferModelType = (images: IngestImageInput[]): ArtifactType => {
  if (
    images.length > 0 &&
    images.every((image) => image.type === "text" || (!image.sourceUrl && Boolean(image.content)))
  ) {
    return "text";
  }
  return "image";
};
