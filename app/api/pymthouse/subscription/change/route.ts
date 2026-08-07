import { NextRequest, NextResponse } from "next/server";
import { PmtHouseError } from "@pymthouse/builder-sdk";
import { changeDashboardBillingSubscription } from "@/lib/dashboard/pymthouse-billing-bff";

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
      { status: 400 }
    );
  }

  try {
    const result = await changeDashboardBillingSubscription({
      planId,
      externalUserId,
      successUrl: body.successUrl?.trim(),
      cancelUrl: body.cancelUrl?.trim(),
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PmtHouseError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    const message =
      error instanceof Error ? error.message : "Failed to change subscription";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
