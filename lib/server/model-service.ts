import "server-only";

import { prisma } from "../prisma";
import { Prisma, type ImageArtifact } from "@prisma/client";
import type {
  DatasetSummary,
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
  datasetId,
  search,
  take
}: {
  datasetId?: string;
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

  if (datasetId) {
    where.imageArtifacts = {
      some: {
        datasetId
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
        where: datasetId ? { datasetId } : undefined,
        select: {
          id: true,
          datasetId: true
        }
      }
    }
  });

  return models.map((model) => {
    const datasetIds = new Set(model.imageArtifacts.map((artifact) => artifact.datasetId));

    return {
      id: model.id,
      name: model.name,
      slug: model.slug,
      description: model.description,
      createdAt: model.createdAt.toISOString(),
      datasetCount: datasetIds.size,
      imageCount: model.imageArtifacts.length
    };
  });
}

export async function listDatasets({
  search,
  take
}: {
  search?: string;
  take?: number;
}): Promise<DatasetSummary[]> {
  const where = search
    ? {
        name: {
          contains: search,
          mode: Prisma.QueryMode.insensitive
        }
      }
    : undefined;

  const datasets = await prisma.dataset.findMany({
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

  return datasets.map((dataset) => {
    const modelIds = new Set(dataset.imageArtifacts.map((artifact) => artifact.modelId));

    return {
      id: dataset.id,
      name: dataset.name,
      slug: dataset.slug,
      createdAt: dataset.createdAt.toISOString(),
      modelCount: modelIds.size,
      imageCount: dataset.imageArtifacts.length
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

  if (config.datasetId) {
    where.datasetId = config.datasetId;
  }

  if (selectedModelIds.length > 0) {
    where.modelId = { in: selectedModelIds };
  }

  const columnCount = Math.max(selectedModelIds.length, 1);
  const effectiveTake = Math.max(take, 1);
  const artifactTake = Math.min(effectiveTake * columnCount, 1000);

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
    skip: cursor ? 1 : 0
  });

  const hasNext = artifacts.length > artifactTake;
  const sliced = hasNext ? artifacts.slice(0, artifactTake) : artifacts;

  return {
    items: await mapArtifactsToGridDTO(sliced),
    nextCursor: hasNext ? artifacts[artifacts.length - 1].id : null
  };
}

export async function mapArtifactsToDTO(artifacts: ImageArtifact[]): Promise<ImageArtifactDTO[]> {
  return Promise.all(artifacts.map((artifact) => mapArtifactToDTO(artifact)));
}

function mapArtifactsToGridDTO(artifacts: ImageArtifact[]): Promise<ImageArtifactDTO[]> {
  return Promise.all(artifacts.map(async (artifact) => {
    const metadata = (artifact.metadata as Record<string, unknown> | null) ?? null;
    const s3Location = resolveS3Location(artifact.sourceUrl, metadata);
    const cacheUrl = s3Location ? `/api/images/cache/${artifact.id}` : null;
    const sourceUrl = await resolveImageSourceUrl({
      sourceUrl: artifact.sourceUrl,
      metadata
    });

    return {
      id: artifact.id,
      modelId: artifact.modelId,
      datasetId: artifact.datasetId,
      filename: artifact.filename,
      prompt: null,
      sourceUrl,
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

async function mapArtifactToDTO(artifact: ImageArtifact): Promise<ImageArtifactDTO> {
  const metadata = (artifact.metadata as Record<string, unknown> | null) ?? null;

  const [sourceUrl, thumbnailUrl] = await Promise.all([
    resolveImageSourceUrl({
      sourceUrl: artifact.sourceUrl,
      metadata
    }),
    artifact.thumbnailUrl
      ? resolveImageSourceUrl({
          sourceUrl: artifact.thumbnailUrl,
          metadata
        })
      : Promise.resolve(null)
  ]);

  const s3Location = resolveS3Location(artifact.sourceUrl, metadata);
  const cacheUrl = s3Location ? `/api/images/cache/${artifact.id}` : null;

  return {
    id: artifact.id,
    modelId: artifact.modelId,
    datasetId: artifact.datasetId,
    filename: artifact.filename,
    prompt: artifact.prompt,
    sourceUrl,
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

export async function deleteDatasetById(id: string) {
  const result = await prisma.$transaction(async (tx) => {
    const dataset = await tx.dataset.findUnique({ where: { id } });
    if (!dataset) {
      throw new EntityNotFoundError("Dataset not found");
    }

    const artifactIds = await tx.imageArtifact
      .findMany({ where: { datasetId: id }, select: { id: true } })
      .then((rows) => rows.map((row) => row.id));

    const deletedArtifacts = await tx.imageArtifact.deleteMany({
      where: { datasetId: id }
    });

    await tx.dataset.delete({ where: { id } });

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
            datasetId: true
          }
        }
      }
    });

    const datasetIds = new Set(updated.imageArtifacts.map((artifact) => artifact.datasetId));

    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      description: updated.description,
      createdAt: updated.createdAt.toISOString(),
      datasetCount: datasetIds.size,
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
          datasetId: true
        }
      }
    }
  });

  if (!model) {
    return null;
  }

  const datasetIds = new Set(model.imageArtifacts.map((artifact) => artifact.datasetId));

  return {
    id: model.id,
    name: model.name,
    slug: model.slug,
    description: model.description,
    createdAt: model.createdAt.toISOString(),
    datasetCount: datasetIds.size,
    imageCount: model.imageArtifacts.length
  };
}

export async function getDatasetDetail(id: string): Promise<DatasetSummary | null> {
  const dataset = await prisma.dataset.findUnique({
    where: { id },
    include: {
      imageArtifacts: {
        select: {
          modelId: true
        }
      }
    }
  });

  if (!dataset) {
    return null;
  }

  const modelIds = new Set(dataset.imageArtifacts.map((artifact) => artifact.modelId));

  return {
    id: dataset.id,
    name: dataset.name,
    slug: dataset.slug,
    createdAt: dataset.createdAt.toISOString(),
    modelCount: modelIds.size,
    imageCount: dataset.imageArtifacts.length
  };
}
