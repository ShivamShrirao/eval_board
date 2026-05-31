import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ensureCached,
  guessImageMime,
  readCachedFile
} from "@/lib/server/image-cache";
import { resolveS3Location } from "@/lib/server/s3-url";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const artifact = await prisma.imageArtifact.findUnique({ where: { id } });
  if (!artifact) {
    return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
  }

  const metadata = (artifact.metadata as Record<string, unknown> | null) ?? null;
  const location = resolveS3Location(artifact.sourceUrl, metadata);
  if (!location) {
    return NextResponse.json({ error: "Artifact is not S3-backed" }, { status: 400 });
  }

  await ensureCached(id, location);

  const file = await readCachedFile(id);
  if (!file) {
    return NextResponse.json(
      { error: "Image not available offline" },
      { status: 502 }
    );
  }

  return new NextResponse(file as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": guessImageMime(artifact.filename),
      "Content-Length": String(file.byteLength),
      "Cache-Control": "private, max-age=86400"
    }
  });
}
