import { NextRequest, NextResponse } from "next/server";
import { getDashboardOwnerWallet } from "@/lib/console/pymthouse-billing-bff";
import {
  WALLET_NO_STORE_HEADERS,
  walletErrorResponse,
} from "./wallet-route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const externalUserId =
    request.nextUrl.searchParams.get("externalUserId")?.trim() || "";
  if (!externalUserId) {
    return NextResponse.json(
      { error: "externalUserId is required" },
      { status: 400, headers: WALLET_NO_STORE_HEADERS },
    );
  }

  try {
    const wallet = await getDashboardOwnerWallet(externalUserId);
    return NextResponse.json(wallet, { headers: WALLET_NO_STORE_HEADERS });
  } catch (error) {
    return walletErrorResponse(error, "Failed to load wallet");
  }
}

/** Per-user auto top-up prefs are retired upstream (410). */
export async function PATCH() {
  return NextResponse.json(
    {
      error:
        "Per-user auto top-up is retired. Soft-negative is configured on the app; usage is billed via progressive invoicing.",
      code: "auto_topup_retired",
    },
    { status: 410, headers: WALLET_NO_STORE_HEADERS },
  );
}
