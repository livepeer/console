import { NextRequest, NextResponse } from "next/server";
import {
  listDashboardWalletPaymentMethods,
  startDashboardWalletPaymentMethodCheckout,
} from "@/lib/dashboard/pymthouse-billing-bff";
import {
  WALLET_NO_STORE_HEADERS,
  checkoutReturnOrigin,
  walletErrorResponse,
} from "../wallet-route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const paymentMethods = await listDashboardWalletPaymentMethods();
    return NextResponse.json(
      { paymentMethods },
      { headers: WALLET_NO_STORE_HEADERS },
    );
  } catch (error) {
    return walletErrorResponse(error, "Failed to load wallet payment methods");
  }
}

export async function POST(request: NextRequest) {
  let body: { successUrl?: string; cancelUrl?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const origin = checkoutReturnOrigin(request);
  const successUrl =
    body.successUrl?.trim() || `${origin}/usage?topup=pm-saved`;
  const cancelUrl = body.cancelUrl?.trim() || `${origin}/usage?topup=canceled`;

  try {
    const result = await startDashboardWalletPaymentMethodCheckout({
      successUrl,
      cancelUrl,
    });
    return NextResponse.json(result);
  } catch (error) {
    return walletErrorResponse(
      error,
      "Failed to start payment method checkout",
    );
  }
}
