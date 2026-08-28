import { NextRequest, NextResponse } from "next/server";
import { listDashboardWalletInvoices } from "@/lib/console/pymthouse-billing-bff";
import { requireConsoleSession } from "@/lib/console/session-user";
import {
  PYMTHOUSE_NO_STORE_HEADERS,
  pymthouseErrorResponse,
} from "@/app/api/pymthouse/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parsePageParam(raw: string | null): number | undefined {
  if (!raw || !/^[1-9]\d*$/.test(raw)) return undefined;
  return Number(raw);
}

export async function GET(request: NextRequest) {
  const page = parsePageParam(request.nextUrl.searchParams.get("page"));
  const pageSize = parsePageParam(request.nextUrl.searchParams.get("pageSize"));

  try {
    const session = await requireConsoleSession();
    const result = await listDashboardWalletInvoices({
      externalUserId: session.externalUserId,
      page,
      pageSize,
    });
    return NextResponse.json(result, { headers: PYMTHOUSE_NO_STORE_HEADERS });
  } catch (error) {
    return pymthouseErrorResponse(error, "Failed to load wallet invoices");
  }
}
