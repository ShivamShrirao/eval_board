import { NextResponse, type NextRequest } from "next/server";
import {
  AUTH_COOKIE_NAME,
  AUTH_HEADER_NAME,
  isValidAuthToken,
  isValidPassword
} from "./lib/auth";

const PUBLIC_PATHS = new Set(["/login", "/api/auth/login"]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const headerPassword = request.headers.get(AUTH_HEADER_NAME);
  if (headerPassword && isValidPassword(headerPassword)) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (await isValidAuthToken(cookie)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  const target = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (target && target !== "/") {
    loginUrl.searchParams.set("next", target);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|_next/data|favicon.ico).*)"]
};
