import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureCached, isCached } from "@/lib/server/image-cache";
import { resolveS3Location } from "@/lib/server/s3-url";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (await isCached(id)) {
    return new NextResponse(null, { status: 204 });
  }

  const artifact = await prisma.imageArtifact.findUnique({
    where: { id },
    select: { sourceUrl: true, metadata: true }
  });
  if (!artifact) {
    return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
  }

  const metadata = (artifact.metadata as Record<string, unknown> | null) ?? null;
  const location = resolveS3Location(artifact.sourceUrl, metadata);
  if (!location) {
    return new NextResponse(null, { status: 204 });
  }

  // Kick off the download in the background and return immediately so
  // the browser is never gated on warm completion.
  void ensureCached(id, location);
  return new NextResponse(null, { status: 202 });
}
