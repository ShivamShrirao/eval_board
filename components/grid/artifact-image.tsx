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

  const handleLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
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
      src={src}
      alt={alt ?? artifact.prompt ?? artifact.filename}
      className={className}
      style={style}
      onClick={onClick}
      onLoad={handleLoad}
      onError={handleError}
    />
  );
}
