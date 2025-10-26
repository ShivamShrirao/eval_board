"use client";

import { useState } from "react";
import type { ImageArtifactDTO } from "../../lib/types";
import { ImageViewer } from "../grid/image-viewer";

interface ImageGalleryProps {
  images: ImageArtifactDTO[];
}

export function ImageGallery({ images }: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);

  if (!images.length) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-500">No images available.</div>;
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
      {images.map((image, index) => (
        <div
          key={image.id}
          className="group flex flex-col gap-3 rounded-2xl border border-slate-900/70 bg-black/60 p-3 shadow-inner shadow-black/20"
        >
          <button
            type="button"
            onClick={() => setCurrentIndex(index)}
            className="relative block overflow-hidden rounded-2xl bg-[#101014] ring-1 ring-white/5 transition hover:ring-slate-400/50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.sourceUrl}
              alt={image.prompt ?? image.filename}
              loading="lazy"
              className="mx-auto block h-auto max-h-[360px] w-full object-contain transition duration-300 group-hover:scale-[1.01]"
            />
          </button>
          <div className="text-xs text-slate-300">
            <div className="font-medium text-slate-100">{image.filename}</div>
            {image.prompt ? <div className="mt-1 text-slate-500">{image.prompt}</div> : null}
          </div>
          <a
            href={image.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 transition hover:text-white"
          >
            Open original ↗
          </a>
        </div>
      ))}

      <ImageViewer
        open={currentIndex !== null}
        artifact={currentIndex !== null ? images[currentIndex] : null}
        onOpenChange={(open) => {
          if (!open) setCurrentIndex(null);
        }}
        onNavigate={(direction) => {
          if (currentIndex === null) return;
          const nextIndex = (() => {
            if (direction === "left" || direction === "up") {
              return currentIndex > 0 ? currentIndex - 1 : currentIndex;
            }
            return currentIndex < images.length - 1 ? currentIndex + 1 : currentIndex;
          })();
          setCurrentIndex(nextIndex);
        }}
      />
    </div>
  );
}
