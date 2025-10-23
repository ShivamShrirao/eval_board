"use client";

import useSWR from "swr";
import type { DatasetSummary } from "../types";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}`);
  }
  return res.json();
};

export function useDatasets(search: string) {
  const params = new URLSearchParams();
  if (search) {
    params.set("search", search);
  }
  params.set("limit", "100");

  const { data, error, isLoading } = useSWR<{ datasets: DatasetSummary[] }>(
    `/api/datasets?${params.toString()}`,
    fetcher
  );

  return {
    datasets: data?.datasets ?? [],
    isLoading,
    isError: Boolean(error)
  };
}
