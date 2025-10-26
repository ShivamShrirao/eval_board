"use client";

import type { ImageArtifactDTO } from "../../lib/types";

interface ImageGalleryProps {
  images: ImageArtifactDTO[];
}

export function ImageGallery({ images }: ImageGalleryProps) {
  if (!images.length) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-500">No images available.</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {images.map((image) => (
        <div
          key={image.id}
          className="flex flex-col gap-2 rounded-2xl border border-slate-900/70 bg-black/60 p-3 text-left shadow-inner shadow-black/20"
        >
          <div className="relative overflow-hidden rounded-2xl bg-[#101014] ring-1 ring-white/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.sourceUrl}
              alt={image.prompt ?? image.filename}
              loading="lazy"
              className="mx-auto block h-auto w-full object-contain"
            />
          </div>
          <div className="text-xs text-slate-300">
            <div className="font-medium text-slate-100">{image.filename}</div>
            {image.prompt ? <div className="mt-1 text-slate-500">{image.prompt}</div> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
