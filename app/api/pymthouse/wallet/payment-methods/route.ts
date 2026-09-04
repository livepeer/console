import { NextRequest, NextResponse } from "next/server";
import {
  ensureDashboardWalletDefaultPaymentMethod,
  listDashboardWalletPaymentMethods,
  startDashboardWalletPaymentMethodCheckout,
} from "@/lib/console/pymthouse-billing-bff";
import { requireConsoleSession } from "@/lib/console/session-user";
import {
  checkoutReturnOrigin,
  PYMTHOUSE_NO_STORE_HEADERS,
  pymthouseErrorResponse,
} from "@/app/api/pymthouse/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireConsoleSession();
    const paymentMethods = await listDashboardWalletPaymentMethods(
      session.externalUserId
    );
    return NextResponse.json(
      { paymentMethods },
      { headers: PYMTHOUSE_NO_STORE_HEADERS }
    );
  } catch (error) {
    return pymthouseErrorResponse(error, "Failed to load wallet payment methods");
  }
}

export async function POST(request: NextRequest) {
  let body: {
    successUrl?: string;
    cancelUrl?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const origin = checkoutReturnOrigin(request);
  const successUrl =
    body.successUrl?.trim() || `${origin}/home?topup=pm-saved`;
  const cancelUrl = body.cancelUrl?.trim() || `${origin}/home?topup=canceled`;

  try {
    const session = await requireConsoleSession();
    const result = await startDashboardWalletPaymentMethodCheckout({
      externalUserId: session.externalUserId,
      successUrl,
      cancelUrl,
    });
    return NextResponse.json(result, { headers: PYMTHOUSE_NO_STORE_HEADERS });
  } catch (error) {
    return pymthouseErrorResponse(
      error,
      "Failed to start payment method checkout"
    );
  }
}

export async function PATCH(request: NextRequest) {
  let body: { ensureDefault?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (body.ensureDefault !== true) {
    return NextResponse.json(
      { error: "ensureDefault: true is required" },
      { status: 400 }
    );
  }

  try {
    const session = await requireConsoleSession();
    const result = await ensureDashboardWalletDefaultPaymentMethod(
      session.externalUserId
    );
    return NextResponse.json(result, { headers: PYMTHOUSE_NO_STORE_HEADERS });
  } catch (error) {
    return pymthouseErrorResponse(
      error,
      "Failed to ensure default payment method"
    );
  }
}
