import { NextRequest, NextResponse } from "next/server";
import { PmtHouseError } from "@pymthouse/builder-sdk";
import { listDashboardUserInvoices } from "@/lib/console/pymthouse-billing-bff";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const externalUserId =
    request.nextUrl.searchParams.get("externalUserId")?.trim() || "";
  if (!externalUserId) {
    return NextResponse.json(
      { error: "externalUserId is required" },
      { status: 400 },
    );
  }

  const pageRaw = Number(request.nextUrl.searchParams.get("page") || "1");
  const pageSizeRaw = Number(
    request.nextUrl.searchParams.get("pageSize") || "20",
  );

  try {
    const result = await listDashboardUserInvoices(externalUserId, {
      page: Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1,
      pageSize:
        Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? pageSizeRaw : 20,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PmtHouseError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    const message =
      error instanceof Error ? error.message : "Failed to load invoices";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
