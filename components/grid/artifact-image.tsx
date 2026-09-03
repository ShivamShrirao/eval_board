"use client";

import { useState } from "react";
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

const dimensionSyncedIds = new Set<string>();

// The browser's measured natural size is authoritative. If the stored
// width/height are empty or wrong, correct them in the DB — once per session
// per artifact, and only when they actually differ.
const syncDimensions = (artifact: ImageArtifactDTO, width: number, height: number) => {
  if (dimensionSyncedIds.has(artifact.id)) {
    return;
  }
  if (artifact.width === width && artifact.height === height) {
    return;
  }
  dimensionSyncedIds.add(artifact.id);
  fetch(`/api/images/${artifact.id}/dimensions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ width, height }),
    keepalive: true
  }).catch(() => {
    dimensionSyncedIds.delete(artifact.id);
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

  if (trackedArtifactId !== artifact.id) {
    setTrackedArtifactId(artifact.id);
    setUseFallback(false);
  }

  const src = useFallback && artifact.cacheUrl ? artifact.cacheUrl : artifact.sourceUrl;

  if (!src) {
    return null;
  }

  const handleLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (naturalWidth > 0 && naturalHeight > 0) {
      onNaturalSize?.(naturalWidth, naturalHeight);
      syncDimensions(artifact, naturalWidth, naturalHeight);
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
      src={src}
      alt={alt ?? artifact.prompt ?? artifact.filename}
      className={className}
      style={style}
      loading="lazy"
      decoding="async"
      onClick={onClick}
      onLoad={handleLoad}
      onError={handleError}
    />
  );
}
