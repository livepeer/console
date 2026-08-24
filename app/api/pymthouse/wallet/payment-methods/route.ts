import { NextRequest, NextResponse } from "next/server";
import {
  listDashboardWalletPaymentMethods,
  startDashboardWalletPaymentMethodCheckout,
  ensureDashboardWalletDefaultPaymentMethod,
} from "@/lib/console/pymthouse-billing-bff";
import {
  WALLET_NO_STORE_HEADERS,
  checkoutReturnOrigin,
  walletErrorResponse,
} from "../wallet-route-helpers";

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
    const paymentMethods =
      await listDashboardWalletPaymentMethods(externalUserId);
    return NextResponse.json(
      { paymentMethods },
      { headers: WALLET_NO_STORE_HEADERS },
    );
  } catch (error) {
    return walletErrorResponse(error, "Failed to load wallet payment methods");
  }
}

export async function POST(request: NextRequest) {
  let body: {
    externalUserId?: string;
    successUrl?: string;
    cancelUrl?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const externalUserId = body.externalUserId?.trim();
  if (!externalUserId) {
    return NextResponse.json(
      { error: "externalUserId is required" },
      { status: 400 },
    );
  }

  const origin = checkoutReturnOrigin(request);
  const successUrl =
    body.successUrl?.trim() || `${origin}/usage?topup=pm-saved`;
  const cancelUrl = body.cancelUrl?.trim() || `${origin}/usage?topup=canceled`;

  try {
    const result = await startDashboardWalletPaymentMethodCheckout({
      externalUserId,
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

export async function PATCH(request: NextRequest) {
  let body: {
    externalUserId?: string;
    ensureDefault?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const externalUserId = body.externalUserId?.trim();
  if (!externalUserId) {
    return NextResponse.json(
      { error: "externalUserId is required" },
      { status: 400 },
    );
  }

  if (body.ensureDefault !== true) {
    return NextResponse.json(
      { error: "ensureDefault: true is required" },
      { status: 400 },
    );
  }

  try {
    const result =
      await ensureDashboardWalletDefaultPaymentMethod(externalUserId);
    return NextResponse.json(result);
  } catch (error) {
    return walletErrorResponse(
      error,
      "Failed to ensure default payment method",
    );
  }
}
