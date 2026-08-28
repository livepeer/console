import { NextResponse } from "next/server";
import { listDashboardUserSubscriptions } from "@/lib/console/pymthouse-billing-bff";
import { requireConsoleSession } from "@/lib/console/session-user";
import {
  PYMTHOUSE_NO_STORE_HEADERS,
  pymthouseErrorResponse,
} from "@/app/api/pymthouse/route-helpers";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireConsoleSession();
    const result = await listDashboardUserSubscriptions(session.externalUserId);
    return NextResponse.json(result, { headers: PYMTHOUSE_NO_STORE_HEADERS });
  } catch (error) {
    return pymthouseErrorResponse(error, "Failed to load subscription history");
  }
}
