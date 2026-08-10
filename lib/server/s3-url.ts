import "server-only";

import { GetBucketLocationCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const S3_URI_PREFIX = "s3://";
const DEFAULT_TTL_SECONDS = 60 * 60;
const MAX_TTL_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_CACHE_REFRESH_WINDOW_SECONDS = 2 * 60;
const DEFAULT_CACHE_MAX_ENTRIES = 20_000;

type JsonRecord = Record<string, unknown>;

export interface S3ObjectLocation {
  bucket: string;
  key: string;
}

interface ResolveImageSourceUrlInput {
  sourceUrl: string;
  metadata?: JsonRecord | null;
}

let s3Client: S3Client | null = null;
const s3ClientsByRegion = new Map<string, S3Client>();
const bucketRegions = new Map<string, string>();
const pendingBucketRegions = new Map<string, Promise<string>>();
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
let hasLoggedBucketRegionFallback = false;

const getClient = () => {
  if (!s3Client) {
    s3Client = new S3Client({});
  }
  return s3Client;
};

export const getS3Client = getClient;

const getDefaultRegion = () => process.env.AWS_REGION || "us-east-1";

const normalizeBucketRegion = (region: string | null | undefined) => {
  const normalized = region?.trim();
  if (!normalized) {
    return "us-east-1";
  }
  return normalized === "EU" ? "eu-west-1" : normalized;
};

const getS3ClientForRegion = (region: string) => {
  const normalizedRegion = normalizeBucketRegion(region);
  let client = s3ClientsByRegion.get(normalizedRegion);
  if (!client) {
    client = new S3Client({ region: normalizedRegion });
    s3ClientsByRegion.set(normalizedRegion, client);
  }
  return client;
};

const getBucketRegionFallback = (bucket: string, error: unknown) => {
  const fallbackRegion = getDefaultRegion();
  if (!hasLoggedBucketRegionFallback) {
    hasLoggedBucketRegionFallback = true;
    console.warn("Failed to detect S3 bucket region; using default region", {
      bucket,
      region: fallbackRegion,
      error
    });
  }
  return fallbackRegion;
};

const detectBucketRegion = async (bucket: string): Promise<string> => {
  try {
    const response = await fetch(`https://s3.amazonaws.com/${encodeURIComponent(bucket)}`, {
      method: "HEAD"
    });
    const region = response.headers.get("x-amz-bucket-region")?.trim();
    if (region) {
      return normalizeBucketRegion(region);
    }
  } catch {
    // Fall through to GetBucketLocation when the unauthenticated request fails.
  }

  try {
    const response = await getS3ClientForRegion("us-east-1").send(
      new GetBucketLocationCommand({ Bucket: bucket })
    );
    return normalizeBucketRegion(response.LocationConstraint);
  } catch (error) {
    return getBucketRegionFallback(bucket, error);
  }
};

export const getBucketRegion = async (bucket: string): Promise<string> => {
  const cachedRegion = bucketRegions.get(bucket);
  if (cachedRegion) {
    return cachedRegion;
  }

  const pendingRegion = pendingBucketRegions.get(bucket);
  if (pendingRegion) {
    return pendingRegion;
  }

  const resolution = detectBucketRegion(bucket)
    .catch((error) => getBucketRegionFallback(bucket, error))
    .then((region) => {
      bucketRegions.set(bucket, region);
      return region;
    })
    .finally(() => {
      pendingBucketRegions.delete(bucket);
    });
  pendingBucketRegions.set(bucket, resolution);
  return resolution;
};

export const getS3ClientForBucket = async (bucket: string): Promise<S3Client> => {
  const region = await getBucketRegion(bucket);
  return getS3ClientForRegion(region);
};

const readPresignTtlSeconds = () => {
  const raw = process.env.S3_PRESIGN_TTL_SECONDS ?? process.env.S3_SIGNED_URL_TTL_SECONDS;
  if (!raw) {
    return DEFAULT_TTL_SECONDS;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_TTL_SECONDS;
  }
  return Math.min(parsed, MAX_TTL_SECONDS);
};

const readCacheRefreshWindowSeconds = () => {
  const raw = process.env.S3_PRESIGN_CACHE_REFRESH_WINDOW_SECONDS;
  if (!raw) {
    return DEFAULT_CACHE_REFRESH_WINDOW_SECONDS;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_CACHE_REFRESH_WINDOW_SECONDS;
  }
  return parsed;
};

const readCacheMaxEntries = () => {
  const raw = process.env.S3_PRESIGN_CACHE_MAX_ENTRIES;
  if (!raw) {
    return DEFAULT_CACHE_MAX_ENTRIES;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 100) {
    return DEFAULT_CACHE_MAX_ENTRIES;
  }
  return parsed;
};

const getCacheKey = (location: S3ObjectLocation) => `${location.bucket}/${location.key}`;

const getCachedSignedUrl = (cacheKey: string, refreshWindowMs: number): string | null => {
  const cached = signedUrlCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt - Date.now() <= refreshWindowMs) {
    signedUrlCache.delete(cacheKey);
    return null;
  }

  return cached.url;
};

const pruneCache = (maxEntries: number) => {
  if (signedUrlCache.size <= maxEntries) {
    return;
  }

  const now = Date.now();
  for (const [key, value] of signedUrlCache) {
    if (value.expiresAt <= now) {
      signedUrlCache.delete(key);
    }
  }

  while (signedUrlCache.size > maxEntries) {
    const oldestKey = signedUrlCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    signedUrlCache.delete(oldestKey);
  }
};

export const parseS3Uri = (value: string): S3ObjectLocation | null => {
  if (!value.startsWith(S3_URI_PREFIX)) {
    return null;
  }
  const withoutScheme = value.slice(S3_URI_PREFIX.length);
  const slash = withoutScheme.indexOf("/");
  if (slash <= 0 || slash === withoutScheme.length - 1) {
    return null;
  }
  const bucket = withoutScheme.slice(0, slash).trim();
  const key = withoutScheme.slice(slash + 1).trim();
  if (!bucket || !key) {
    return null;
  }
  return { bucket, key };
};

const isLikelyAwsPresignedUrl = (value: string) => {
  try {
    const url = new URL(value);
    return (
      url.searchParams.has("X-Amz-Signature") ||
      url.searchParams.has("X-Amz-Credential") ||
      url.searchParams.has("AWSAccessKeyId") ||
      url.searchParams.has("Signature")
    );
  } catch {
    return false;
  }
};

export const resolveS3Location = (
  sourceUrl: string,
  metadata: JsonRecord | null | undefined
): S3ObjectLocation | null => {
  const direct = parseS3Uri(sourceUrl);
  if (direct) {
    return direct;
  }
  const meta = parseS3LocationFromMetadata(metadata ?? null);
  if (meta && isLikelyAwsPresignedUrl(sourceUrl)) {
    return meta;
  }
  return null;
};

const parseS3LocationFromMetadata = (metadata: JsonRecord | null | undefined): S3ObjectLocation | null => {
  if (!metadata) {
    return null;
  }
  const bucket = metadata.s3_bucket;
  const key = metadata.s3_key;
  if (typeof bucket !== "string" || typeof key !== "string") {
    return null;
  }
  const trimmedBucket = bucket.trim();
  const trimmedKey = key.trim();
  if (!trimmedBucket || !trimmedKey) {
    return null;
  }
  return {
    bucket: trimmedBucket,
    key: trimmedKey
  };
};

export async function resolveImageSourceUrl({
  sourceUrl,
  metadata
}: ResolveImageSourceUrlInput): Promise<string> {
  const direct = parseS3Uri(sourceUrl);
  const metadataLocation = parseS3LocationFromMetadata(metadata ?? null);

  const location =
    direct ?? (metadataLocation && isLikelyAwsPresignedUrl(sourceUrl) ? metadataLocation : null);

  if (!location) {
    return sourceUrl;
  }

  const ttlSeconds = readPresignTtlSeconds();
  const cacheRefreshWindowMs = readCacheRefreshWindowSeconds() * 1000;
  const cacheKey = getCacheKey(location);
  const cachedUrl = getCachedSignedUrl(cacheKey, cacheRefreshWindowMs);
  if (cachedUrl) {
    return cachedUrl;
  }

  try {
    const command = new GetObjectCommand({
      Bucket: location.bucket,
      Key: location.key
    });
    const signedUrl = await getSignedUrl(await getS3ClientForBucket(location.bucket), command, {
      expiresIn: ttlSeconds
    });
    signedUrlCache.set(cacheKey, {
      url: signedUrl,
      expiresAt: Date.now() + ttlSeconds * 1000
    });
    pruneCache(readCacheMaxEntries());
    return signedUrl;
  } catch (error) {
    console.error("Failed to generate S3 presigned URL", {
      bucket: location.bucket,
      key: location.key,
      error
    });
    return sourceUrl;
  }
}
