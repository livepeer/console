import { NextRequest, NextResponse } from "next/server";
import { PmtHouseError } from "@pymthouse/builder-sdk";
import {
  listDashboardUserPaymentMethods,
  removeDashboardUserPaymentMethod,
  ensureDashboardUserDefaultPaymentMethod,
  setDashboardUserDefaultPaymentMethod,
  startDashboardPaymentMethodCheckout,
} from "@/lib/console/pymthouse-billing-bff";

export const runtime = "nodejs";

function checkoutReturnOrigin(request: NextRequest): string {
  const configuredOrigin = (
    process.env.DASHBOARD_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");
  let origin = configuredOrigin || request.nextUrl.origin;
  try {
    const parsed = new URL(origin);
    if (
      parsed.protocol === "http:" &&
      parsed.hostname !== "localhost" &&
      parsed.hostname !== "127.0.0.1"
    ) {
      parsed.protocol = "https:";
      origin = parsed.origin;
    } else {
      origin = parsed.origin;
    }
  } catch {
    origin = request.nextUrl.origin;
  }
  return origin;
}

export async function GET(request: NextRequest) {
  const externalUserId =
    request.nextUrl.searchParams.get("externalUserId")?.trim() || "";
  if (!externalUserId) {
    return NextResponse.json(
      { error: "externalUserId is required" },
      { status: 400 },
    );
  }

  try {
    const paymentMethods =
      await listDashboardUserPaymentMethods(externalUserId);
    return NextResponse.json({ paymentMethods });
  } catch (error) {
    if (error instanceof PmtHouseError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    const message =
      error instanceof Error ? error.message : "Failed to load payment methods";
    return NextResponse.json({ error: message }, { status: 502 });
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
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
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
    body.successUrl?.trim() ||
    `${origin}/settings?tab=billing&checkout=success`;
  const cancelUrl =
    body.cancelUrl?.trim() || `${origin}/settings?tab=billing&checkout=cancel`;

  try {
    const result = await startDashboardPaymentMethodCheckout({
      externalUserId,
      successUrl,
      cancelUrl,
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
      error instanceof Error
        ? error.message
        : "Failed to start payment method checkout";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

async function readPaymentMethodMutation(request: NextRequest): Promise<
  | { externalUserId: string; paymentMethodId: string }
  | NextResponse
> {
  let body: { externalUserId?: string; paymentMethodId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const externalUserId = body.externalUserId?.trim();
  const paymentMethodId = body.paymentMethodId?.trim();
  if (!externalUserId || !paymentMethodId) {
    return NextResponse.json(
      { error: "externalUserId and paymentMethodId are required" },
      { status: 400 },
    );
  }
  return { externalUserId, paymentMethodId };
}

export async function PATCH(request: NextRequest) {
  let body: {
    externalUserId?: string;
    paymentMethodId?: string;
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

  if (body.ensureDefault === true) {
    try {
      return NextResponse.json(
        await ensureDashboardUserDefaultPaymentMethod(externalUserId),
      );
    } catch (error) {
      return billingErrorResponse(error, "Failed to ensure default payment method");
    }
  }

  const paymentMethodId = body.paymentMethodId?.trim();
  if (!paymentMethodId) {
    return NextResponse.json(
      { error: "paymentMethodId is required" },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      await setDashboardUserDefaultPaymentMethod(
        externalUserId,
        paymentMethodId,
      ),
    );
  } catch (error) {
    return billingErrorResponse(error, "Failed to set default payment method");
  }
}

export async function DELETE(request: NextRequest) {
  const input = await readPaymentMethodMutation(request);
  if (input instanceof NextResponse) {
    return input;
  }
  try {
    return NextResponse.json(
      await removeDashboardUserPaymentMethod(
        input.externalUserId,
        input.paymentMethodId,
      ),
    );
  } catch (error) {
    return billingErrorResponse(error, "Failed to remove payment method");
  }
}

function billingErrorResponse(error: unknown, fallback: string): NextResponse {
  if (error instanceof PmtHouseError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: 502 },
  );
}
