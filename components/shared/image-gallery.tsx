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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {images.map((image, index) => (
        <button
          key={image.id}
          type="button"
          onClick={() => setCurrentIndex(index)}
          className="group flex flex-col gap-3 rounded-xl border border-slate-900 bg-black/60 p-3 text-left transition hover:border-slate-600"
        >
          <div className="flex h-48 items-center justify-center overflow-hidden rounded-lg bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.sourceUrl}
              alt={image.prompt ?? image.filename}
              loading="lazy"
              className="h-full max-h-48 w-full object-contain"
            />
          </div>
          <div className="text-xs text-slate-300">
            <div className="font-medium text-slate-100">{image.filename}</div>
            {image.prompt ? <div className="mt-1 text-slate-500">{image.prompt}</div> : null}
          </div>
        </button>
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
