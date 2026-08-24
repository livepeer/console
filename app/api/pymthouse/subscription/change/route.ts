import { NextRequest, NextResponse } from "next/server";
import { PmtHouseError } from "@pymthouse/builder-sdk";
import { changeDashboardBillingSubscription } from "@/lib/console/pymthouse-billing-bff";
import { requireConsoleSession } from "@/lib/console/session-user";
import {
  PYMTHOUSE_NO_STORE_HEADERS,
  pymthouseErrorResponse,
} from "@/app/api/pymthouse/route-helpers";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: {
    planId?: string;
    successUrl?: string;
    cancelUrl?: string;
    timing?: string;
    effectiveAt?: string;
    confirmReplaceScheduled?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const planId = body.planId?.trim();
  if (!planId) {
    return NextResponse.json({ error: "planId is required" }, { status: 400 });
  }

  try {
    const session = await requireConsoleSession();
    const result = await changeDashboardBillingSubscription({
      planId,
      externalUserId: session.externalUserId,
      successUrl: body.successUrl?.trim(),
      cancelUrl: body.cancelUrl?.trim(),
      timing: body.timing?.trim(),
      effectiveAt: body.effectiveAt?.trim(),
      confirmReplaceScheduled: body.confirmReplaceScheduled === true,
    });
    return NextResponse.json(result, { headers: PYMTHOUSE_NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof PmtHouseError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          ...(error.details && typeof error.details === "object"
            ? (error.details as Record<string, unknown>)
            : {}),
        },
        { status: error.status, headers: PYMTHOUSE_NO_STORE_HEADERS }
      );
    }
    return pymthouseErrorResponse(error, "Failed to change subscription");
  }
}
