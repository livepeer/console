import { NextRequest, NextResponse } from "next/server";
import { PmtHouseError } from "@pymthouse/builder-sdk";
import { getDashboardUserInvoiceHostedUrl } from "@/lib/dashboard/pymthouse-billing-bff";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  const externalUserId =
    request.nextUrl.searchParams.get("externalUserId")?.trim() || "";
  const { invoiceId: rawInvoiceId } = await params;
  const invoiceId = decodeURIComponent(rawInvoiceId).trim();

  if (!externalUserId) {
    return NextResponse.json(
      { error: "externalUserId is required" },
      { status: 400 },
    );
  }
  if (!invoiceId) {
    return NextResponse.json(
      { error: "invoiceId is required" },
      { status: 400 },
    );
  }

  try {
    const links = await getDashboardUserInvoiceHostedUrl(
      externalUserId,
      invoiceId,
    );
    return NextResponse.json(links);
  } catch (error) {
    if (error instanceof PmtHouseError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    const message =
      error instanceof Error ? error.message : "Failed to resolve invoice link";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
