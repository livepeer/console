import { NextRequest, NextResponse } from "next/server";
import { PmtHouseError } from "@pymthouse/builder-sdk";
import { startDashboardBillingCheckout } from "@/lib/dashboard/pymthouse-billing-bff";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: {
    planId?: string;
    externalUserId?: string;
    successUrl?: string;
    cancelUrl?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const planId = body.planId?.trim();
  const externalUserId = body.externalUserId?.trim();
  if (!planId || !externalUserId) {
    return NextResponse.json(
      { error: "planId and externalUserId are required" },
      { status: 400 },
    );
  }

  // Prefer an explicit public HTTPS origin (Stripe rejects most http return
  // URLs). Fall back to the request origin; for local http://localhost Next
  // can be started with `next dev --experimental-https`.
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
      origin = parsed.origin;
    } else {
      origin = parsed.origin;
    }
  } catch {
    origin = request.nextUrl.origin;
  }
  const successUrl =
    body.successUrl?.trim() || `${origin}/usage?checkout=success`;
  const cancelUrl =
    body.cancelUrl?.trim() || `${origin}/usage?checkout=cancel`;

  try {
    const result = await startDashboardBillingCheckout({
      planId,
      externalUserId,
      successUrl,
      cancelUrl,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PmtHouseError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    const message =
      error instanceof Error ? error.message : "Failed to start checkout";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
