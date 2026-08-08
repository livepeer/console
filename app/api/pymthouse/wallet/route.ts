import { NextResponse } from "next/server";
import { getDashboardOwnerWallet } from "@/lib/dashboard/pymthouse-billing-bff";
import {
  WALLET_NO_STORE_HEADERS,
  walletErrorResponse,
} from "./wallet-route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const wallet = await getDashboardOwnerWallet();
    return NextResponse.json(wallet, { headers: WALLET_NO_STORE_HEADERS });
  } catch (error) {
    return walletErrorResponse(error, "Failed to load wallet");
  }
}
