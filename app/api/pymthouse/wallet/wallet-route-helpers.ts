import { NextRequest, NextResponse } from "next/server";
import { PmtHouseError } from "@pymthouse/builder-sdk";

// Wallet/balance is live money data; never let the browser or a CDN replay a
// stale response.
export const WALLET_NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
} as const;

export function walletErrorResponse(
  error: unknown,
  fallback: string,
): NextResponse {
  if (error instanceof PmtHouseError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status, headers: WALLET_NO_STORE_HEADERS },
    );
  }
  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: 502, headers: WALLET_NO_STORE_HEADERS },
  );
}

/** Https-preferring public origin for Stripe Checkout return URLs. */
export function checkoutReturnOrigin(request: NextRequest): string {
  const configuredOrigin = (
    process.env.DASHBOARD_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");
  let origin = configuredOrigin || request.nextUrl.origin;
  try {
    const parsed = new URL(origin);
    if (
      parsed.protocol === "http:" &&
      parsed.hostname !== "localhost" &&
      parsed.hostname !== "127.0.0.1"
    ) {
      parsed.protocol = "https:";
    }
    origin = parsed.origin;
  } catch {
    origin = request.nextUrl.origin;
  }
  return origin;
}
