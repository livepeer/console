import { NextRequest, NextResponse } from "next/server";
import { cancelDashboardUserSubscription } from "@/lib/console/pymthouse-billing-bff";
import { requireConsoleSession } from "@/lib/console/session-user";
import {
  PYMTHOUSE_NO_STORE_HEADERS,
  pymthouseErrorResponse,
} from "@/app/api/pymthouse/route-helpers";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: { timing?: string; effectiveAt?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    const session = await requireConsoleSession();
    await cancelDashboardUserSubscription(session.externalUserId, {
      timing: body.timing?.trim(),
      effectiveAt: body.effectiveAt?.trim(),
    });
    return NextResponse.json(
      { ok: true },
      { headers: PYMTHOUSE_NO_STORE_HEADERS }
    );
  } catch (error) {
    return pymthouseErrorResponse(error, "Failed to cancel subscription");
  }
}
