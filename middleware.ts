import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import {
  isAllowlistExemptPath,
  isAllowlistGatedPath,
  isEmailAllowlisted,
} from "@/lib/console/email-allowlist";

function copyAuthCookies(from: NextResponse, to: NextResponse): NextResponse {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
  return to;
}

export async function middleware(request: NextRequest) {
  const authRes = await auth0.middleware(request);
  const { pathname } = request.nextUrl;
  if (isAllowlistExemptPath(pathname) || !isAllowlistGatedPath(pathname)) {
    return authRes;
  }

  try {
    const session = await auth0.getSession(request);
    if (!session?.user) {
      return authRes;
    }
    if (!isEmailAllowlisted(session.user.email)) {
      return copyAuthCookies(
        authRes,
        NextResponse.redirect(new URL("/waitlist", request.url)),
      );
    }
  } catch {
    return authRes;
  }

  return authRes;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
