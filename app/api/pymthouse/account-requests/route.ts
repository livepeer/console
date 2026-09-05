import { NextRequest, NextResponse } from "next/server";
import { attachOutputsToTickets } from "@/lib/console/activity-assets";
import { fetchAccountRequestsForExternalUser } from "@/lib/console/pymthouse-bff";
import { requireConsoleSession } from "@/lib/console/session-user";
import {
  PYMTHOUSE_NO_STORE_HEADERS,
  pymthouseErrorResponse,
} from "@/app/api/pymthouse/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cursor =
    request.nextUrl.searchParams.get("cursor")?.trim() || undefined;
  const limitRaw = request.nextUrl.searchParams.get("limit");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 50;
  if (!Number.isFinite(limit) || limit < 1 || limit > 50) {
    return NextResponse.json(
      { error: "limit must be between 1 and 50" },
      { status: 400, headers: PYMTHOUSE_NO_STORE_HEADERS }
    );
  }

  try {
    const session = await requireConsoleSession();
    const payload = await fetchAccountRequestsForExternalUser({
      externalUserId: session.externalUserId,
      email: session.email,
      cursor,
      limit,
    });
    const items = await attachOutputsToTickets(
      session.externalUserId,
      payload.items
    );
    return NextResponse.json(
      { ...payload, items },
      { headers: PYMTHOUSE_NO_STORE_HEADERS }
    );
  } catch (error) {
    return pymthouseErrorResponse(error, "Requests fetch failed");
  }
}
