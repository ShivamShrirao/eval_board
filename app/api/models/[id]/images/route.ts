import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { clearModelImages, EntityNotFoundError } from "@/lib/server/model-service";

const paramsSchema = z.object({
  id: z.string().uuid("Invalid model id")
});

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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const parsed = paramsSchema.safeParse(resolvedParams);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request parameters",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  try {
    const result = await clearModelImages(parsed.data.id);
    return NextResponse.json(
      {
        modelId: result.modelId,
        deletedArtifacts: result.deletedArtifacts
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof EntityNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error("Failed to clear model images", error);
    return NextResponse.json({ error: "Failed to clear model images" }, { status: 500 });
  }
}
