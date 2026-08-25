import { NextResponse } from "next/server";

import {
  PYMTHOUSE_NO_STORE_HEADERS,
  pymthouseErrorResponse,
} from "@/app/api/pymthouse/route-helpers";
import { readSessionMeBilling } from "@/lib/console/pymthouse-me-billing-bff";
import { requireConsoleSession } from "@/lib/console/session-user";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireConsoleSession();
    const surface = await readSessionMeBilling({
      externalUserId: session.externalUserId,
      email: session.email,
    });
    return NextResponse.json(surface, { headers: PYMTHOUSE_NO_STORE_HEADERS });
  } catch (error) {
    return pymthouseErrorResponse(error, "Failed to load end-user billing");
  }
}
