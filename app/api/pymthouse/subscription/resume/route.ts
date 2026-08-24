import { NextResponse } from "next/server";
import { PmtHouseError } from "@pymthouse/builder-sdk";
import { resumeDashboardUserSubscription } from "@/lib/console/pymthouse-billing-bff";
import { requireConsoleSession } from "@/lib/console/session-user";
import {
  PYMTHOUSE_NO_STORE_HEADERS,
  pymthouseErrorResponse,
} from "@/app/api/pymthouse/route-helpers";

export const runtime = "nodejs";

function upstreamCode(error: PmtHouseError): string {
  const details = error.details;
  if (details && typeof details === "object" && "code" in details) {
    const code = (details as { code?: unknown }).code;
    if (typeof code === "string" && code.trim()) return code;
  }
  return error.code;
}

export async function POST() {
  try {
    const session = await requireConsoleSession();
    await resumeDashboardUserSubscription(session.externalUserId);
    return NextResponse.json(
      { ok: true },
      { headers: PYMTHOUSE_NO_STORE_HEADERS }
    );
  } catch (error) {
    if (error instanceof PmtHouseError) {
      return NextResponse.json(
        { error: error.message, code: upstreamCode(error) },
        { status: error.status, headers: PYMTHOUSE_NO_STORE_HEADERS }
      );
    }
    return pymthouseErrorResponse(error, "Failed to resume subscription");
  }
}
