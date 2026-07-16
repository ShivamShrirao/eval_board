"use client";

import useSWR from "swr";
import type { BenchmarkSummary } from "../types";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}`);
  }
  return res.json();
};

export function useBenchmarks(search: string) {
  const params = new URLSearchParams();
  if (search) {
    params.set("search", search);
  }
  params.set("limit", "100");

  const { data, error, isLoading, mutate } = useSWR<{ benchmarks: BenchmarkSummary[] }>(
    `/api/benchmarks?${params.toString()}`,
    fetcher
  );

  return {
    benchmarks: data?.benchmarks ?? [],
    isLoading,
    isError: Boolean(error),
    refresh: () => mutate()
  };
}
