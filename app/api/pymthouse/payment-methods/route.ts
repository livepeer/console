import { NextRequest, NextResponse } from "next/server";
import {
  ensureDashboardUserDefaultPaymentMethod,
  listDashboardUserPaymentMethods,
  removeDashboardUserPaymentMethod,
  setDashboardUserDefaultPaymentMethod,
  startDashboardPaymentMethodCheckout,
} from "@/lib/console/pymthouse-billing-bff";
import { requireConsoleSession } from "@/lib/console/session-user";
import {
  checkoutReturnOrigin,
  PYMTHOUSE_NO_STORE_HEADERS,
  pymthouseErrorResponse,
} from "@/app/api/pymthouse/route-helpers";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireConsoleSession();
    const paymentMethods = await listDashboardUserPaymentMethods(
      session.externalUserId
    );
    return NextResponse.json(
      { paymentMethods },
      { headers: PYMTHOUSE_NO_STORE_HEADERS }
    );
  } catch (error) {
    return pymthouseErrorResponse(error, "Failed to load payment methods");
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
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const origin = checkoutReturnOrigin(request);
  const successUrl =
    body.successUrl?.trim() || `${origin}/home?checkout=success`;
  const cancelUrl =
    body.cancelUrl?.trim() || `${origin}/home?checkout=cancel`;

  try {
    const session = await requireConsoleSession();
    const result = await startDashboardPaymentMethodCheckout({
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
  let body: {
    paymentMethodId?: string;
    ensureDefault?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    const session = await requireConsoleSession();
    if (body.ensureDefault === true) {
      return NextResponse.json(
        await ensureDashboardUserDefaultPaymentMethod(session.externalUserId),
        { headers: PYMTHOUSE_NO_STORE_HEADERS }
      );
    }

    const paymentMethodId = body.paymentMethodId?.trim();
    if (!paymentMethodId) {
      return NextResponse.json(
        { error: "paymentMethodId is required" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      await setDashboardUserDefaultPaymentMethod(
        session.externalUserId,
        paymentMethodId
      ),
      { headers: PYMTHOUSE_NO_STORE_HEADERS }
    );
  } catch (error) {
    return pymthouseErrorResponse(error, "Failed to set default payment method");
  }
}

export async function DELETE(request: NextRequest) {
  let body: { paymentMethodId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const paymentMethodId = body.paymentMethodId?.trim();
  if (!paymentMethodId) {
    return NextResponse.json(
      { error: "paymentMethodId is required" },
      { status: 400 }
    );
  }

  try {
    const session = await requireConsoleSession();
    return NextResponse.json(
      await removeDashboardUserPaymentMethod(
        session.externalUserId,
        paymentMethodId
      ),
      { headers: PYMTHOUSE_NO_STORE_HEADERS }
    );
  } catch (error) {
    return pymthouseErrorResponse(error, "Failed to remove payment method");
  }
}
