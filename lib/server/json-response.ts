import "server-only";

import { gzipSync } from "node:zlib";
import { NextResponse } from "next/server";

const GZIP_THRESHOLD_BYTES = 1024;

export function jsonResponse(data: unknown, request: Request, init: ResponseInit = {}): Response {
  const body = JSON.stringify(data);
  const acceptEncoding = request.headers.get("accept-encoding") ?? "";
  const wantsGzip = acceptEncoding.toLowerCase().includes("gzip");

  if (!wantsGzip || body.length < GZIP_THRESHOLD_BYTES) {
    return NextResponse.json(data, init);
  }

  const compressed = gzipSync(body);
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("content-encoding", "gzip");
  headers.set("vary", "accept-encoding");
  headers.set("content-length", String(compressed.byteLength));
  return new Response(compressed as unknown as BodyInit, { ...init, headers });
}
