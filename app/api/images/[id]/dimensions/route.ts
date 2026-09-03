import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive()
});

// Self-healing image dimensions: the client sends the browser-measured natural
// size when it renders an image; if the stored width/height are empty or wrong,
// we correct them here. Only writes on an actual change so updatedAt (and the
// derived cache-busting URL) stays stable once the value is right.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid dimensions" }, { status: 400 });
  }
  const { width, height } = parsed.data;

  const artifact = await prisma.imageArtifact.findUnique({
    where: { id },
    select: { width: true, height: true }
  });
  if (!artifact) {
    return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
  }

  if (artifact.width === width && artifact.height === height) {
    return NextResponse.json({ updated: false });
  }

  await prisma.imageArtifact.update({
    where: { id },
    data: { width, height }
  });
  return NextResponse.json({ updated: true, width, height });
}
