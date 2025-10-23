import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const artifacts = await prisma.imageArtifact.findMany({
    where: { modelId: id },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({
    items: artifacts.map((artifact) => ({
      id: artifact.id,
      modelId: artifact.modelId,
      datasetId: artifact.datasetId,
      filename: artifact.filename,
      prompt: artifact.prompt,
      sourceUrl: artifact.sourceUrl,
      thumbnailUrl: artifact.thumbnailUrl,
      width: artifact.width,
      height: artifact.height,
      metadata: artifact.metadata,
      createdAt: artifact.createdAt.toISOString(),
      capturedAt: artifact.capturedAt?.toISOString() ?? null
    }))
  });
}
