import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { mapArtifactsToDTO } from "@/lib/server/model-service";
import { jsonResponse } from "@/lib/server/json-response";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const artifacts = await prisma.imageArtifact.findMany({
    where: { datasetId: id },
    orderBy: { createdAt: "desc" }
  });

  return jsonResponse({ items: await mapArtifactsToDTO(artifacts) }, request);
}
