import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_MAX_AGE_SECONDS,
  AUTH_COOKIE_NAME,
  computeAuthToken,
  isValidPassword
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const password =
    payload && typeof payload === "object" && "password" in payload
      ? String((payload as Record<string, unknown>).password ?? "")
      : "";

  if (!isValidPassword(password)) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const token = await computeAuthToken(password);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_SECONDS
  });
  return response;
}
