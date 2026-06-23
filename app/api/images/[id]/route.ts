import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { mapArtifactsToDTO } from "@/lib/server/model-service";
import { jsonResponse } from "@/lib/server/json-response";

const paramsSchema = z.object({
  id: z.string().uuid("Invalid image id")
});

export async function GET(
  request: NextRequest,
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

  const artifact = await prisma.imageArtifact.findUnique({
    where: { id: parsed.data.id }
  });

  if (!artifact) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  const [item] = await mapArtifactsToDTO([artifact]);
  return jsonResponse({ item }, request);
}
