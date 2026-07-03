import { NextResponse } from "next/server";
import { z } from "zod";
import { ingestPayload } from "../../../lib/server/ingest-service";

const s3UriPattern = /^s3:\/\/[^/]+\/.+$/;

const sourceUrlSchema = z
  .string()
  .min(1, "sourceUrl is required")
  .refine((value) => {
    if (s3UriPattern.test(value)) {
      return true;
    }

    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }, "sourceUrl must be a valid URL or s3:// URI");

const artifactTypeSchema = z.enum(["image", "text"]);

const imageSchema = z.object({
  filename: z.string().min(1, "filename is required"),
  type: artifactTypeSchema.optional().nullable(),
  sourceUrl: sourceUrlSchema.optional().nullable(),
  content: z.string().optional().nullable(),
  prompt: z.string().optional().nullable(),
  thumbnailUrl: sourceUrlSchema.optional().nullable(),
  width: z.number().int().min(1).max(16384).optional().nullable(),
  height: z.number().int().min(1).max(16384).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  capturedAt: z.string().datetime().optional().nullable()
});

const ingestSchema = z.object({
  model: z.object({
    name: z.string().min(1, "model name is required"),
    slug: z.string().optional().nullable(),
    type: artifactTypeSchema.optional().nullable(),
    description: z.string().optional().nullable()
  }),
  dataset: z.object({
    name: z.string().min(1, "dataset name is required"),
    slug: z.string().optional().nullable()
  }),
  images: z.array(imageSchema).max(2000)
}).superRefine((payload, ctx) => {
  payload.images.forEach((image, index) => {
    const type = image.type ?? payload.model.type ?? (!image.sourceUrl && image.content ? "text" : "image");
    if (type === "text") {
      if (!image.content?.trim()) {
        ctx.addIssue({
          code: "custom",
          message: "content is required for text artifacts",
          path: ["images", index, "content"]
        });
      }
      return;
    }

    if (!image.sourceUrl) {
      ctx.addIssue({
        code: "custom",
        message: "sourceUrl is required for image artifacts",
        path: ["images", index, "sourceUrl"]
      });
    }
  });
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = ingestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid payload",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  const result = await ingestPayload(parsed.data);

  return NextResponse.json(
    {
      status: "ok",
      ...result
    },
    { status: 202 }
  );
}
