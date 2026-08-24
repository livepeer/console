import { NextResponse } from "next/server";
import { getDashboardOwnerWallet } from "@/lib/console/pymthouse-billing-bff";
import { requireConsoleSession } from "@/lib/console/session-user";
import {
  PYMTHOUSE_NO_STORE_HEADERS,
  pymthouseErrorResponse,
} from "@/app/api/pymthouse/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireConsoleSession();
    const wallet = await getDashboardOwnerWallet(session.externalUserId);
    return NextResponse.json(wallet, { headers: PYMTHOUSE_NO_STORE_HEADERS });
  } catch (error) {
    return pymthouseErrorResponse(error, "Failed to load wallet");
  }
}
