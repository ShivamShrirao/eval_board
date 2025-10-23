"use client";

import { useMemo } from "react";
import useSWR from "swr";
import type { GridViewConfig, ImageArtifactDTO } from "../types";

interface GridResponse {
  items: ImageArtifactDTO[];
  nextCursor: string | null;
}

const fetcher = async ([, config]: [string, GridViewConfig]) => {
  const res = await fetch("/api/images", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ config, take: 500 })
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Failed to load grid data: ${detail}`);
  }

  return (await res.json()) as GridResponse;
};

export interface GridCell {
  artifact: ImageArtifactDTO | null;
}

export interface GridRow {
  key: string;
  label: string;
  filename: string;
  prompt?: string | null;
  createdAt: string;
  cells: GridCell[];
}

export function useGridData(config: GridViewConfig) {
  const shouldFetch = config.columns.length > 0 && Boolean(config.datasetId);

  const {
    data,
    error,
    isLoading: swrLoading
  } = useSWR<GridResponse>(
    shouldFetch ? ["grid", config] : null,
    fetcher,
    {
      revalidateOnFocus: false,
      keepPreviousData: true
    }
  );

  const rows = useMemo<GridRow[]>(() => {
    if (!data || !shouldFetch) {
      return [];
    }

    const columnModelIds = config.columns.map((column) => column.modelId);
    const map = new Map<string, GridRow>();

    for (const item of data.items) {
      const columnIndex = columnModelIds.indexOf(item.modelId);
      if (columnIndex === -1) {
        continue;
      }

      const keySource = config.breakdownBy === "prompt" && item.prompt ? item.prompt : item.filename;
      const key = keySource || item.id;
      const label = item.filename || item.prompt || key;

      if (!map.has(key)) {
        map.set(key, {
          key,
          label,
          filename: item.filename,
          prompt: item.prompt,
          createdAt: item.createdAt,
          cells: columnModelIds.map(() => ({ artifact: null }))
        });
      }

      const row = map.get(key)!;
      row.cells[columnIndex] = { artifact: item };
    }

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [config, data, shouldFetch]);

  return {
    rows,
    isLoading: shouldFetch ? Boolean(swrLoading) : false,
    isError: shouldFetch ? Boolean(error) : false
  };
}
