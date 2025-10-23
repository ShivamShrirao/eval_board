import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getViewConfig, upsertViewConfig } from "../../../lib/server/view-storage";
import { gridConfigSchema } from "../../../lib/validation/grid";

const GRID_CONTEXT = "grid";

const getQuerySchema = z.object({
  id: z.string().min(1, "id is required"),
  context: z.string().min(1).optional()
});

const postBodySchema = z.object({
  context: z.string().min(1).optional(),
  key: z
    .string()
    .min(1, "key is required")
    .max(64, "key must be <= 64 characters"),
  value: gridConfigSchema
});

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const raw = {
    id: url.searchParams.get("id"),
    context: url.searchParams.get("context") ?? undefined
  };

  const parsed = getQuerySchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid query parameters",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  const context = parsed.data.context ?? GRID_CONTEXT;
  const record = await getViewConfig(parsed.data.id, context);

  if (!record) {
    return NextResponse.json(
      {
        error: "View not found"
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    id: parsed.data.id,
    context,
    value: record.config,
    updatedAt: record.updatedAt.toISOString()
  });
}

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const parsed = postBodySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid payload",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  const context = parsed.data.context ?? GRID_CONTEXT;
  await upsertViewConfig(parsed.data.key, parsed.data.value, context);

  return NextResponse.json(
    {
      id: parsed.data.key,
      context,
      value: parsed.data.value
    },
    { status: 201 }
  );
}
