import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fetchArtifactsForGrid } from "../../../lib/server/model-service";
import { jsonResponse } from "../../../lib/server/json-response";
import { gridConfigSchema } from "../../../lib/validation/grid";

const requestSchema = z.object({
  config: gridConfigSchema,
  cursor: z.string().uuid().optional().nullable(),
  take: z
    .union([z.number(), z.string()])
    .transform((value) => Number(value))
    .refine((value) => Number.isInteger(value) && value > 0 && value <= 200, {
      message: "take must be an integer between 1 and 200"
    })
    .optional()
});

export async function POST(request: NextRequest) {
  const json = await request.json();
  const parsed = requestSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid payload",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  const { items, nextCursor } = await fetchArtifactsForGrid({
    config: parsed.data.config,
    cursor: parsed.data.cursor ?? undefined,
    take: parsed.data.take ?? 50
  });

  return jsonResponse({ items, nextCursor }, request);
}
