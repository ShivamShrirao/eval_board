import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { deleteDatasetById, EntityNotFoundError } from "../../../../lib/server/model-service";

const paramsSchema = z.object({
  id: z.string().uuid("Invalid dataset id")
});

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const result = await deleteDatasetById(parsed.data.id);
    return NextResponse.json(
      {
        deletedArtifacts: result.deletedArtifacts
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof EntityNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error("Failed to delete dataset", error);
    return NextResponse.json({ error: "Failed to delete dataset" }, { status: 500 });
  }
}
