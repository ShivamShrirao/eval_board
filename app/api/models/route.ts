import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listModels } from "../../../lib/server/model-service";

const querySchema = z.object({
  datasetId: z.string().uuid().optional(),
  search: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length ? value : undefined)),
  limit: z
    .string()
    .transform((value) => Number.parseInt(value, 10))
    .refine((value) => Number.isInteger(value) && value > 0, {
      message: "limit must be a positive integer"
    })
    .optional()
});

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const raw = Object.fromEntries(url.searchParams);
  const parsed = querySchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid query parameters",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  const models = await listModels({
    datasetId: parsed.data.datasetId,
    search: parsed.data.search,
    take: parsed.data.limit
  });

  return NextResponse.json({
    models
  });
}
