import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listDatasets } from "../../../lib/server/model-service";

const querySchema = z.object({
  search: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length ? value : undefined)),
  limit: z
    .string()
    .transform((value) => Number.parseInt(value, 10))
    .refine((value) => Number.isInteger(value) && value > 0 && value <= 100, {
      message: "limit must be between 1 and 100"
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

  const datasets = await listDatasets({
    search: parsed.data.search,
    take: parsed.data.limit ?? 20
  });

  return NextResponse.json({
    datasets
  });
}
