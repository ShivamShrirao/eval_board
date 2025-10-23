import "server-only";

import { prisma } from "../prisma";
import type { GridViewConfig } from "../types";
import { gridConfigSchema } from "../validation/grid";

const DEFAULT_CONTEXT = "grid";

export async function getViewConfig(
  key: string,
  context = DEFAULT_CONTEXT
): Promise<{ config: GridViewConfig; updatedAt: Date } | null> {
  const record = await prisma.viewKV.findUnique({
    where: {
      context_key: {
        context,
        key
      }
    }
  });

  if (!record) {
    return null;
  }

  const config = gridConfigSchema.parse(record.value);

  return {
    config,
    updatedAt: record.updatedAt
  };
}

export async function upsertViewConfig(
  key: string,
  value: GridViewConfig,
  context = DEFAULT_CONTEXT
) {
  const normalized = gridConfigSchema.parse(value);

  return prisma.viewKV.upsert({
    where: {
      context_key: {
        context,
        key
      }
    },
    update: {
      value: normalized,
      updatedAt: new Date()
    },
    create: {
      context,
      key,
      value: normalized
    }
  });
}
