import { NextRequest, NextResponse } from "next/server";
import { startDashboardWalletTopUp } from "@/lib/console/pymthouse-billing-bff";
import { requireConsoleSession } from "@/lib/console/session-user";
import {
  checkoutReturnOrigin,
  PYMTHOUSE_NO_STORE_HEADERS,
  pymthouseErrorResponse,
} from "@/app/api/pymthouse/route-helpers";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: {
    amountUsd?: string | number;
    successUrl?: string;
    cancelUrl?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const amountUsd =
    typeof body.amountUsd === "number"
      ? body.amountUsd.toFixed(2)
      : body.amountUsd?.trim();
  if (!amountUsd) {
    return NextResponse.json(
      { error: 'amountUsd is required (e.g. "25.00")' },
      { status: 400 }
    );
  }

  const origin = checkoutReturnOrigin(request);
  const successUrl =
    body.successUrl?.trim() || `${origin}/usage?topup=succeeded`;
  const cancelUrl = body.cancelUrl?.trim() || `${origin}/usage?topup=canceled`;

  try {
    const session = await requireConsoleSession();
    const result = await startDashboardWalletTopUp({
      amountUsd,
      externalUserId: session.externalUserId,
      successUrl,
      cancelUrl,
    });
    return NextResponse.json(result, { headers: PYMTHOUSE_NO_STORE_HEADERS });
  } catch (error) {
    return pymthouseErrorResponse(error, "Failed to start top-up checkout");
  }
}
