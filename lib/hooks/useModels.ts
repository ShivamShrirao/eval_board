"use client";

import useSWR from "swr";
import type { ModelSummary } from "../types";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}`);
  }
  return res.json();
};

export function useModels(search: string) {
  const params = new URLSearchParams();
  if (search) {
    params.set("search", search);
  }
  params.set("limit", "100");

  const { data, error, isLoading, mutate } = useSWR<{ models: ModelSummary[] }>(
    `/api/models?${params.toString()}`,
    fetcher
  );

  return {
    models: data?.models ?? [],
    isLoading,
    isError: Boolean(error),
    refresh: () => mutate()
  };
}
