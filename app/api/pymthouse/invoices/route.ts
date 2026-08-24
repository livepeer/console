import { NextRequest, NextResponse } from "next/server";
import { listDashboardUserInvoices } from "@/lib/console/pymthouse-billing-bff";
import { requireConsoleSession } from "@/lib/console/session-user";
import {
  PYMTHOUSE_NO_STORE_HEADERS,
  pymthouseErrorResponse,
} from "@/app/api/pymthouse/route-helpers";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const pageRaw = Number(request.nextUrl.searchParams.get("page") || "1");
  const pageSizeRaw = Number(
    request.nextUrl.searchParams.get("pageSize") || "20"
  );

  try {
    const session = await requireConsoleSession();
    const result = await listDashboardUserInvoices(session.externalUserId, {
      page: Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1,
      pageSize:
        Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : 20,
    });
    return NextResponse.json(result, { headers: PYMTHOUSE_NO_STORE_HEADERS });
  } catch (error) {
    return pymthouseErrorResponse(error, "Failed to load invoices");
  }
}
