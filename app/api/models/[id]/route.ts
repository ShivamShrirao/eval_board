import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  deleteModelById,
  DuplicateNameError,
  EntityNotFoundError,
  updateModelName
} from "../../../../lib/server/model-service";

const paramsSchema = z.object({
  id: z.string().uuid("Invalid model id")
});

const updateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "name is required")
    .max(120, "name must be 120 characters or fewer")
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
    const result = await deleteModelById(parsed.data.id);
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

    console.error("Failed to delete model", error);
    return NextResponse.json({ error: "Failed to delete model" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const parsedParams = paramsSchema.safeParse(resolvedParams);

  if (!parsedParams.success) {
    return NextResponse.json(
      {
        error: "Invalid request parameters",
        details: parsedParams.error.flatten()
      },
      { status: 400 }
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json(
      {
        error: "Invalid JSON payload"
      },
      { status: 400 }
    );
  }

  const parsedBody = updateSchema.safeParse(payload);
  if (!parsedBody.success) {
    return NextResponse.json(
      {
        error: "Invalid payload",
        details: parsedBody.error.flatten()
      },
      { status: 400 }
    );
  }

  try {
    const model = await updateModelName(parsedParams.data.id, parsedBody.data.name);
    return NextResponse.json({ model });
  } catch (error) {
    if (error instanceof EntityNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof DuplicateNameError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Failed to rename model", error);
    return NextResponse.json({ error: "Failed to rename model" }, { status: 500 });
  }
}
