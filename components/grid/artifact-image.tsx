"use client";

import { useEffect, useRef, useState } from "react";
import type { ImageArtifactDTO } from "../../lib/types";

const warmedArtifactIds = new Set<string>();

const warmCache = (artifactId: string) => {
  if (warmedArtifactIds.has(artifactId)) {
    return;
  }
  warmedArtifactIds.add(artifactId);
  fetch(`/api/images/cache/${artifactId}/warm`, {
    method: "POST",
    keepalive: true
  }).catch(() => {
    warmedArtifactIds.delete(artifactId);
  });
};

interface ArtifactImageProps {
  artifact: ImageArtifactDTO;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (event: React.MouseEvent<HTMLImageElement>) => void;
  onNaturalSize?: (width: number, height: number) => void;
}

export function ArtifactImage({ artifact, alt, className, style, onClick, onNaturalSize }: ArtifactImageProps) {
  const [useFallback, setUseFallback] = useState(false);
  const [trackedArtifactId, setTrackedArtifactId] = useState(artifact.id);
  // Gate the actual download until the cell is in/near the viewport and has
  // settled there — so a fast scroll or jump-to-bottom doesn't start loads for
  // every row it flies past, leaving S3's ~6 HTTP/1.1 connections free for the
  // rows you actually land on.
  const [shouldLoad, setShouldLoad] = useState(false);
  // Reveal on load via an opacity flip. Setting a fresh src on an element
  // inside the virtualizer's transformed (composited) row layer can leave the
  // decoded image unpainted until a global repaint (e.g. a tab switch) — the
  // opacity change forces the compositor to re-raster the layer immediately.
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  if (trackedArtifactId !== artifact.id) {
    setTrackedArtifactId(artifact.id);
    setUseFallback(false);
    setShouldLoad(false);
    setLoaded(false);
  }

  const resolvedSrc = useFallback && artifact.cacheUrl ? artifact.cacheUrl : artifact.sourceUrl;

  useEffect(() => {
    if (shouldLoad) {
      return;
    }
    const el = imgRef.current;
    if (!el) {
      return;
    }
    let settleTimer: number | undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          // Only commit the load if it stays near the viewport briefly; a
          // fly-through leaves before the timer fires and never loads.
          settleTimer = window.setTimeout(() => setShouldLoad(true), 120);
        } else if (settleTimer !== undefined) {
          window.clearTimeout(settleTimer);
          settleTimer = undefined;
        }
      },
      // Preload a bit above/below the viewport so scrolling stays smooth.
      { root: null, rootMargin: "900px 0px", threshold: 0 }
    );
    observer.observe(el);
    return () => {
      if (settleTimer !== undefined) {
        window.clearTimeout(settleTimer);
      }
      observer.disconnect();
    };
  }, [artifact.id, shouldLoad]);

  if (!resolvedSrc) {
    return null;
  }

  const handleLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    setLoaded(true);
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (naturalWidth > 0 && naturalHeight > 0) {
      onNaturalSize?.(naturalWidth, naturalHeight);
    }

    if (!useFallback && artifact.cacheUrl) {
      warmCache(artifact.id);
    }
  };

  const handleError = () => {
    if (!useFallback && artifact.cacheUrl) {
      setUseFallback(true);
    }
  };

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imgRef}
      src={shouldLoad ? resolvedSrc : undefined}
      alt={alt ?? artifact.prompt ?? artifact.filename}
      className={className}
      style={{ ...style, opacity: loaded ? 1 : 0, transition: "opacity 150ms ease-out" }}
      onClick={onClick}
      onLoad={handleLoad}
      onError={handleError}
    />
  );
}
