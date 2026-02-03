import "server-only";

import { prisma } from "../prisma";
import { Prisma } from "@prisma/client";
import type {
  DatasetSummary,
  GridViewConfig,
  ImageArtifactDTO,
  ModelSummary
} from "../types";

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
  search,
  take
}: {
  search?: string;
  take?: number;
}): Promise<ModelSummary[]> {
  const where = search
    ? {
        name: {
          contains: search,
          mode: Prisma.QueryMode.insensitive
        }
      }
    : undefined;

  const models = await prisma.model.findMany({
    where,
    orderBy: {
      createdAt: "desc"
    },
    take,
    include: {
      imageArtifacts: {
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

  const groupField = config.breakdownBy === "prompt" ? "prompt" : "filename";

  const orderBy: Prisma.ImageArtifactOrderByWithRelationInput[] =
    config.sortBy === "createdAt"
      ? [
          { createdAt: "desc" },
          { modelId: "asc" },
          { [groupField]: "asc" } as Prisma.ImageArtifactOrderByWithRelationInput,
          { id: "asc" }
        ]
      : [
          { [groupField]: "asc" } as Prisma.ImageArtifactOrderByWithRelationInput,
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
    items: sliced.map((artifact) => ({
      id: artifact.id,
      modelId: artifact.modelId,
      datasetId: artifact.datasetId,
      filename: artifact.filename,
      prompt: artifact.prompt,
      sourceUrl: artifact.sourceUrl,
      thumbnailUrl: artifact.thumbnailUrl,
      width: artifact.width,
      height: artifact.height,
      metadata: artifact.metadata as Record<string, unknown> | null,
      createdAt: artifact.createdAt.toISOString(),
      capturedAt: artifact.capturedAt?.toISOString() ?? null
    })),
    nextCursor: hasNext ? artifacts[artifacts.length - 1].id : null
  };
}

export async function deleteModelById(id: string) {
  return prisma.$transaction(async (tx) => {
    const model = await tx.model.findUnique({ where: { id } });
    if (!model) {
      throw new EntityNotFoundError("Model not found");
    }

    const deletedArtifacts = await tx.imageArtifact.deleteMany({
      where: { modelId: id }
    });

    await tx.model.delete({ where: { id } });

    return {
      deletedArtifacts: deletedArtifacts.count
    };
  });
}

export async function clearModelImages(id: string) {
  return prisma.$transaction(async (tx) => {
    const model = await tx.model.findUnique({ where: { id } });
    if (!model) {
      throw new EntityNotFoundError("Model not found");
    }

    const deletedArtifacts = await tx.imageArtifact.deleteMany({
      where: { modelId: id }
    });

    return {
      modelId: id,
      deletedArtifacts: deletedArtifacts.count
    };
  });
}

export async function deleteDatasetById(id: string) {
  return prisma.$transaction(async (tx) => {
    const dataset = await tx.dataset.findUnique({ where: { id } });
    if (!dataset) {
      throw new EntityNotFoundError("Dataset not found");
    }

    const deletedArtifacts = await tx.imageArtifact.deleteMany({
      where: { datasetId: id }
    });

    await tx.dataset.delete({ where: { id } });

    return {
      deletedArtifacts: deletedArtifacts.count
    };
  });
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
