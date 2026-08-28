import { NextResponse } from "next/server";
import { listDashboardBillingPlans } from "@/lib/console/pymthouse-billing-bff";
import { requireConsoleSession } from "@/lib/console/session-user";
import {
  PYMTHOUSE_NO_STORE_HEADERS,
  pymthouseErrorResponse,
} from "@/app/api/pymthouse/route-helpers";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireConsoleSession();
    const plans = await listDashboardBillingPlans(session.externalUserId);
    return NextResponse.json(
      { plans },
      { headers: PYMTHOUSE_NO_STORE_HEADERS }
    );
  } catch (error) {
    return pymthouseErrorResponse(error, "Failed to list billing plans");
  }
}
