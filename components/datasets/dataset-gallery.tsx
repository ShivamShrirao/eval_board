"use client";

import useSWR from "swr";
import { ImageGallery } from "../shared/image-gallery";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}`);
  }
  return res.json();
};

export function DatasetGallery({ datasetId }: { datasetId: string }) {
  const { data, error, isLoading } = useSWR(`/api/datasets/${datasetId}/images`, fetcher);

  if (isLoading) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-500">Loading images...</div>;
  }

  if (error || !data) {
    return <div className="flex h-full items-center justify-center text-sm text-red-400">Failed to load images.</div>;
  }

  return <ImageGallery images={data.items} />;
}
