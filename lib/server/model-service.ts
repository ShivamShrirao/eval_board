import "server-only";

import { prisma } from "../prisma";
import { Prisma, type ImageArtifact } from "@prisma/client";
import type {
  BenchmarkSummary,
  GridViewConfig,
  ImageArtifactDTO,
  ModelSummary
} from "../types";
import { resolveImageSourceUrl, resolveS3Location } from "./s3-url";
import { removeCachedFiles } from "./image-cache";

export class EntityNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EntityNotFoundError";
  }
}

export class DuplicateNameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuplicateNameError";
  }
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

export async function listModels({
  benchmarkId,
  search,
  take
}: {
  benchmarkId?: string;
  search?: string;
  take?: number;
}): Promise<ModelSummary[]> {
  const where: Prisma.ModelWhereInput = {};

  if (search) {
    where.name = {
      contains: search,
      mode: Prisma.QueryMode.insensitive
    };
  }

  if (benchmarkId) {
    where.imageArtifacts = {
      some: {
        benchmarkId
      }
    };
  }

  const models = await prisma.model.findMany({
    where,
    orderBy: {
      createdAt: "desc"
    },
    take,
    include: {
      imageArtifacts: {
        where: benchmarkId ? { benchmarkId } : undefined,
        select: {
          id: true,
          benchmarkId: true
        }
      }
    }
  });

  return models.map((model) => {
    const benchmarkIds = new Set(model.imageArtifacts.map((artifact) => artifact.benchmarkId));

    return {
      id: model.id,
      name: model.name,
      slug: model.slug,
      type: model.type,
      description: model.description,
      createdAt: model.createdAt.toISOString(),
      benchmarkCount: benchmarkIds.size,
      imageCount: model.imageArtifacts.length
    };
  });
}

export async function listBenchmarks({
  search,
  take
}: {
  search?: string;
  take?: number;
}): Promise<BenchmarkSummary[]> {
  const where = search
    ? {
        name: {
          contains: search,
          mode: Prisma.QueryMode.insensitive
        }
      }
    : undefined;

  const benchmarks = await prisma.benchmark.findMany({
    where,
    orderBy: {
      createdAt: "desc"
    },
    take,
    include: {
      imageArtifacts: {
        select: {
          id: true,
          modelId: true
        }
      }
    }
  });

  return benchmarks.map((benchmark) => {
    const modelIds = new Set(benchmark.imageArtifacts.map((artifact) => artifact.modelId));

    return {
      id: benchmark.id,
      name: benchmark.name,
      slug: benchmark.slug,
      createdAt: benchmark.createdAt.toISOString(),
      modelCount: modelIds.size,
      imageCount: benchmark.imageArtifacts.length
    };
  });
}

export async function fetchArtifactsForGrid({
  config,
  cursor,
  take
}: {
  config: GridViewConfig;
  cursor?: string | null;
  take: number;
}): Promise<{ items: ImageArtifactDTO[]; nextCursor: string | null }> {
  const selectedModelIds = Array.from(
    new Set(
      config.columns
        .map((column) => column.modelId)
        .filter((value): value is string => Boolean(value))
    )
  );

  const where: Prisma.ImageArtifactWhereInput = {};

  if (config.benchmarkId) {
    where.benchmarkId = config.benchmarkId;
  }

  if (selectedModelIds.length > 0) {
    where.modelId = { in: selectedModelIds };
  }

  const columnCount = Math.max(selectedModelIds.length, 1);
  const effectiveTake = Math.max(take, 1);
  // Page size only — the client pages through `nextCursor` to load every row,
  // so there is no overall row cap.
  const artifactTake = effectiveTake * columnCount;

  const orderBy: Prisma.ImageArtifactOrderByWithRelationInput[] =
    config.sortBy === "createdAt"
      ? [
          { createdAt: "desc" },
          { modelId: "asc" },
          { filename: "asc" },
          { id: "asc" }
        ]
      : [
          { filename: "asc" },
          { modelId: "asc" },
          { createdAt: "desc" },
          { id: "asc" }
        ];

  const artifacts = await prisma.imageArtifact.findMany({
    where,
    orderBy,
    take: artifactTake + 1,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    include: { model: { select: { name: true } } }
  });

  const hasNext = artifacts.length > artifactTake;
  const sliced = hasNext ? artifacts.slice(0, artifactTake) : artifacts;

  return {
    items: await mapArtifactsToGridDTO(sliced),
    nextCursor: hasNext ? artifacts[artifacts.length - 1].id : null
  };
}

// Artifacts optionally carry their model relation (name only) so the DTO can
// expose `modelName` without a second query. Callers that don't include it just
// yield `modelName: null`.
type ArtifactWithModel = ImageArtifact & { model?: { name: string | null } | null };

export async function mapArtifactsToDTO(artifacts: ArtifactWithModel[]): Promise<ImageArtifactDTO[]> {
  return Promise.all(artifacts.map((artifact) => mapArtifactToDTO(artifact)));
}

function mapArtifactsToGridDTO(artifacts: ArtifactWithModel[]): Promise<ImageArtifactDTO[]> {
  return Promise.all(artifacts.map(async (artifact) => {
    const metadata = (artifact.metadata as Record<string, unknown> | null) ?? null;
    const s3Location = artifact.sourceUrl ? resolveS3Location(artifact.sourceUrl, metadata) : null;
    const cacheUrl = s3Location
      ? `/api/images/cache/${artifact.id}?v=${artifact.updatedAt.getTime()}`
      : null;
    const sourceUrl =
      artifact.type === "image" && artifact.sourceUrl
        ? await resolveImageSourceUrl({
            sourceUrl: artifact.sourceUrl,
            metadata
          })
        : null;

    return {
      id: artifact.id,
      modelId: artifact.modelId,
      modelName: artifact.model?.name ?? null,
      benchmarkId: artifact.benchmarkId,
      filename: artifact.filename,
      type: artifact.type,
      prompt: null,
      editInstruction: null,
      sourceUrl,
      content: artifact.type === "text" ? artifact.content : null,
      cacheUrl,
      thumbnailUrl: null,
      width: artifact.width,
      height: artifact.height,
      metadata: null,
      createdAt: artifact.createdAt.toISOString(),
      capturedAt: artifact.capturedAt?.toISOString() ?? null
    };
  }));
}

async function mapArtifactToDTO(artifact: ArtifactWithModel): Promise<ImageArtifactDTO> {
  const metadata = (artifact.metadata as Record<string, unknown> | null) ?? null;

  const [sourceUrl, thumbnailUrl] = await Promise.all([
    artifact.type === "image" && artifact.sourceUrl
      ? resolveImageSourceUrl({
          sourceUrl: artifact.sourceUrl,
          metadata
        })
      : Promise.resolve(null),
    artifact.type === "image" && artifact.thumbnailUrl
      ? resolveImageSourceUrl({
          sourceUrl: artifact.thumbnailUrl,
          metadata
        })
      : Promise.resolve(null)
  ]);

  const s3Location = artifact.sourceUrl ? resolveS3Location(artifact.sourceUrl, metadata) : null;
  const cacheUrl = s3Location
    ? `/api/images/cache/${artifact.id}?v=${artifact.updatedAt.getTime()}`
    : null;

  return {
    id: artifact.id,
    modelId: artifact.modelId,
    modelName: artifact.model?.name ?? null,
    benchmarkId: artifact.benchmarkId,
    filename: artifact.filename,
    type: artifact.type,
    prompt: artifact.prompt,
    editInstruction: artifact.editInstruction,
    sourceUrl,
    content: artifact.content,
    cacheUrl,
    thumbnailUrl,
    width: artifact.width,
    height: artifact.height,
    metadata,
    createdAt: artifact.createdAt.toISOString(),
    capturedAt: artifact.capturedAt?.toISOString() ?? null
  };
}

export async function deleteModelById(id: string) {
  const result = await prisma.$transaction(async (tx) => {
    const model = await tx.model.findUnique({ where: { id } });
    if (!model) {
      throw new EntityNotFoundError("Model not found");
    }

    const artifactIds = await tx.imageArtifact
      .findMany({ where: { modelId: id }, select: { id: true } })
      .then((rows) => rows.map((row) => row.id));

    const deletedArtifacts = await tx.imageArtifact.deleteMany({
      where: { modelId: id }
    });

    await tx.model.delete({ where: { id } });

    return {
      artifactIds,
      deletedArtifacts: deletedArtifacts.count
    };
  });

  await removeCachedFiles(result.artifactIds);

  return { deletedArtifacts: result.deletedArtifacts };
}

export async function clearModelImages(id: string) {
  const result = await prisma.$transaction(async (tx) => {
    const model = await tx.model.findUnique({ where: { id } });
    if (!model) {
      throw new EntityNotFoundError("Model not found");
    }

    const artifactIds = await tx.imageArtifact
      .findMany({ where: { modelId: id }, select: { id: true } })
      .then((rows) => rows.map((row) => row.id));

    const deletedArtifacts = await tx.imageArtifact.deleteMany({
      where: { modelId: id }
    });

    return {
      artifactIds,
      modelId: id,
      deletedArtifacts: deletedArtifacts.count
    };
  });

  await removeCachedFiles(result.artifactIds);

  return { modelId: result.modelId, deletedArtifacts: result.deletedArtifacts };
}

export async function deleteBenchmarkById(id: string) {
  const result = await prisma.$transaction(async (tx) => {
    const benchmark = await tx.benchmark.findUnique({ where: { id } });
    if (!benchmark) {
      throw new EntityNotFoundError("Benchmark not found");
    }

    const artifactIds = await tx.imageArtifact
      .findMany({ where: { benchmarkId: id }, select: { id: true } })
      .then((rows) => rows.map((row) => row.id));

    const deletedArtifacts = await tx.imageArtifact.deleteMany({
      where: { benchmarkId: id }
    });

    await tx.benchmark.delete({ where: { id } });

    return {
      artifactIds,
      deletedArtifacts: deletedArtifacts.count
    };
  });

  await removeCachedFiles(result.artifactIds);

  return { deletedArtifacts: result.deletedArtifacts };
}

export async function updateModelName(id: string, name: string): Promise<ModelSummary> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Name is required");
  }

  try {
    const updated = await prisma.model.update({
      where: { id },
      data: {
        name: trimmed,
        slug: slugify(trimmed)
      },
      include: {
        imageArtifacts: {
          select: {
            benchmarkId: true
          }
        }
      }
    });

    const benchmarkIds = new Set(updated.imageArtifacts.map((artifact) => artifact.benchmarkId));

    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      type: updated.type,
      description: updated.description,
      createdAt: updated.createdAt.toISOString(),
      benchmarkCount: benchmarkIds.size,
      imageCount: updated.imageArtifacts.length
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        throw new EntityNotFoundError("Model not found");
      }
      if (error.code === "P2002") {
        throw new DuplicateNameError("A model with that name already exists.");
      }
    }
    throw error;
  }
}

export async function getModelDetail(id: string): Promise<ModelSummary | null> {
  const model = await prisma.model.findUnique({
    where: { id },
    include: {
      imageArtifacts: {
        select: {
          benchmarkId: true
        }
      }
    }
  });

  if (!model) {
    return null;
  }

  const benchmarkIds = new Set(model.imageArtifacts.map((artifact) => artifact.benchmarkId));

  return {
    id: model.id,
    name: model.name,
    slug: model.slug,
    type: model.type,
    description: model.description,
    createdAt: model.createdAt.toISOString(),
    benchmarkCount: benchmarkIds.size,
    imageCount: model.imageArtifacts.length
  };
}

export async function getBenchmarkDetail(id: string): Promise<BenchmarkSummary | null> {
  const benchmark = await prisma.benchmark.findUnique({
    where: { id },
    include: {
      imageArtifacts: {
        select: {
          modelId: true
        }
      }
    }
  });

  if (!benchmark) {
    return null;
  }

  const modelIds = new Set(benchmark.imageArtifacts.map((artifact) => artifact.modelId));

  return {
    id: benchmark.id,
    name: benchmark.name,
    slug: benchmark.slug,
    createdAt: benchmark.createdAt.toISOString(),
    modelCount: modelIds.size,
    imageCount: benchmark.imageArtifacts.length
  };
}
