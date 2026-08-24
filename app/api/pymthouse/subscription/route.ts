import { NextResponse } from "next/server";
import { getDashboardUserSubscription } from "@/lib/console/pymthouse-billing-bff";
import { requireConsoleSession } from "@/lib/console/session-user";
import {
  PYMTHOUSE_NO_STORE_HEADERS,
  pymthouseErrorResponse,
} from "@/app/api/pymthouse/route-helpers";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireConsoleSession();
    const subscription = await getDashboardUserSubscription(
      session.externalUserId
    );
    return NextResponse.json(
      { subscription },
      { headers: PYMTHOUSE_NO_STORE_HEADERS }
    );
  } catch (error) {
    return pymthouseErrorResponse(error, "Failed to load subscription");
  }
}
