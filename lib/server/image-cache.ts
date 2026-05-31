import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client, type S3ObjectLocation } from "./s3-url";

const DEFAULT_CACHE_DIR = "/var/cache/eval-board/images";

const inflightDownloads = new Map<string, Promise<boolean>>();

export const getCacheDir = () => process.env.IMAGE_CACHE_DIR?.trim() || DEFAULT_CACHE_DIR;

export const getCacheFilePath = (artifactId: string) => {
  const shard = artifactId.slice(0, 2) || "_";
  return path.join(getCacheDir(), shard, `${artifactId}.bin`);
};

export const isCached = async (artifactId: string): Promise<boolean> => {
  try {
    await fs.access(getCacheFilePath(artifactId));
    return true;
  } catch {
    return false;
  }
};

export const ensureCached = async (
  artifactId: string,
  location: S3ObjectLocation
): Promise<boolean> => {
  if (await isCached(artifactId)) {
    return true;
  }
  const existing = inflightDownloads.get(artifactId);
  if (existing) {
    return existing;
  }
  const promise = downloadFromS3(artifactId, location).finally(() => {
    inflightDownloads.delete(artifactId);
  });
  inflightDownloads.set(artifactId, promise);
  return promise;
};

const downloadFromS3 = async (
  artifactId: string,
  location: S3ObjectLocation
): Promise<boolean> => {
  const filePath = getCacheFilePath(artifactId);
  try {
    const response = await getS3Client().send(
      new GetObjectCommand({ Bucket: location.bucket, Key: location.key })
    );
    const body = response.Body as { transformToByteArray?: () => Promise<Uint8Array> } | undefined;
    if (!body?.transformToByteArray) {
      throw new Error("S3 response body missing transformToByteArray");
    }
    const bytes = await body.transformToByteArray();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(tmpPath, bytes);
    await fs.rename(tmpPath, filePath);
    return true;
  } catch (error) {
    console.warn("[image-cache] failed to download artifact", {
      artifactId,
      bucket: location.bucket,
      key: location.key,
      error: (error as Error).message
    });
    return false;
  }
};

export const readCachedFile = async (artifactId: string): Promise<Buffer | null> => {
  try {
    return await fs.readFile(getCacheFilePath(artifactId));
  } catch {
    return null;
  }
};

export const removeCachedFile = async (artifactId: string): Promise<void> => {
  try {
    await fs.unlink(getCacheFilePath(artifactId));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn("[image-cache] failed to remove cached file", { artifactId, error });
    }
  }
};

export const removeCachedFiles = async (artifactIds: string[]): Promise<void> => {
  await Promise.all(artifactIds.map((id) => removeCachedFile(id)));
};

export const guessImageMime = (filename: string): string => {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".avif":
      return "image/avif";
    case ".tif":
    case ".tiff":
      return "image/tiff";
    case ".bmp":
      return "image/bmp";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
};
