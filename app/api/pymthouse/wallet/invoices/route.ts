import { NextRequest, NextResponse } from "next/server";
import { listDashboardWalletInvoices } from "@/lib/dashboard/pymthouse-billing-bff";
import {
  WALLET_NO_STORE_HEADERS,
  walletErrorResponse,
} from "../wallet-route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parsePageParam(raw: string | null): number | undefined {
  if (!raw || !/^[1-9]\d*$/.test(raw)) return undefined;
  return Number(raw);
}

export async function GET(request: NextRequest) {
  const externalUserId =
    request.nextUrl.searchParams.get("externalUserId")?.trim() || "";
  if (!externalUserId) {
    return NextResponse.json(
      { error: "externalUserId is required" },
      { status: 400, headers: WALLET_NO_STORE_HEADERS },
    );
  }

  const page = parsePageParam(request.nextUrl.searchParams.get("page"));
  const pageSize = parsePageParam(request.nextUrl.searchParams.get("pageSize"));

  try {
    const result = await listDashboardWalletInvoices({
      externalUserId,
      page,
      pageSize,
    });
    return NextResponse.json(result, { headers: WALLET_NO_STORE_HEADERS });
  } catch (error) {
    return walletErrorResponse(error, "Failed to load wallet invoices");
  }
}
