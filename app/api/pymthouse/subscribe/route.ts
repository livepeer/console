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

  const origin = request.nextUrl.origin;
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
