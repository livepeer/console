import { NextRequest, NextResponse } from "next/server";
import { getDashboardUserInvoiceHostedUrl } from "@/lib/console/pymthouse-billing-bff";
import { requireConsoleSession } from "@/lib/console/session-user";
import {
  PYMTHOUSE_NO_STORE_HEADERS,
  pymthouseErrorResponse,
} from "@/app/api/pymthouse/route-helpers";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const { invoiceId: rawInvoiceId } = await params;
  const invoiceId = decodeURIComponent(rawInvoiceId).trim();

  if (!invoiceId) {
    return NextResponse.json(
      { error: "invoiceId is required" },
      { status: 400 }
    );
  }

  try {
    const session = await requireConsoleSession();
    const links = await getDashboardUserInvoiceHostedUrl(
      session.externalUserId,
      invoiceId
    );
    return NextResponse.json(links, { headers: PYMTHOUSE_NO_STORE_HEADERS });
  } catch (error) {
    return pymthouseErrorResponse(error, "Failed to resolve invoice link");
  }
}
