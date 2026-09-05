import { NextResponse } from "next/server";
import { waitlistAuthLoginPath } from "@/lib/waitlist/auth-join";
export const runtime = "nodejs";
export function GET(request: Request) {
  return NextResponse.redirect(
    new URL(
      waitlistAuthLoginPath(new URL(request.url).searchParams),
      request.url
    )
  );
}
