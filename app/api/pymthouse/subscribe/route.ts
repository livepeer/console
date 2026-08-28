import { NextRequest, NextResponse } from "next/server";
import { startDashboardBillingCheckout } from "@/lib/console/pymthouse-billing-bff";
import { requireConsoleSession } from "@/lib/console/session-user";
import {
  checkoutReturnOrigin,
  PYMTHOUSE_NO_STORE_HEADERS,
  pymthouseErrorResponse,
} from "@/app/api/pymthouse/route-helpers";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: { planId?: string; successUrl?: string; cancelUrl?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const planId = body.planId?.trim();
  if (!planId) {
    return NextResponse.json({ error: "planId is required" }, { status: 400 });
  }

  const origin = checkoutReturnOrigin(request);
  const successUrl =
    body.successUrl?.trim() || `${origin}/usage?checkout=success`;
  const cancelUrl = body.cancelUrl?.trim() || `${origin}/usage?checkout=cancel`;

  try {
    const session = await requireConsoleSession();
    const result = await startDashboardBillingCheckout({
      planId,
      externalUserId: session.externalUserId,
      successUrl,
      cancelUrl,
    });
    return NextResponse.json(result, { headers: PYMTHOUSE_NO_STORE_HEADERS });
  } catch (error) {
    return pymthouseErrorResponse(error, "Failed to start checkout");
  }
}
