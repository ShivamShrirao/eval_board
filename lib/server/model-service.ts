import "server-only";

import { prisma } from "../prisma";
import { Prisma } from "@prisma/client";
import type {
  DatasetSummary,
  GridViewConfig,
  ImageArtifactDTO,
  ModelSummary
} from "../types";

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
  const where: Record<string, unknown> = {};

  if (config.datasetId) {
    where.datasetId = config.datasetId;
  }

  const artifacts = await prisma.imageArtifact.findMany({
    where,
    orderBy: {
      createdAt: "desc"
    },
    take: take + 1,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0
  });

  const hasNext = artifacts.length > take;
  const sliced = hasNext ? artifacts.slice(0, take) : artifacts;

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
