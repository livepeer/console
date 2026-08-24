import { NextRequest, NextResponse } from "next/server";
import { startDashboardWalletTopUp } from "@/lib/console/pymthouse-billing-bff";
import {
  checkoutReturnOrigin,
  walletErrorResponse,
} from "../wallet-route-helpers";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: {
    amountUsd?: string | number;
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

  const amountUsd =
    typeof body.amountUsd === "number"
      ? body.amountUsd.toFixed(2)
      : body.amountUsd?.trim();
  if (!amountUsd) {
    return NextResponse.json(
      { error: 'amountUsd is required (e.g. "25.00")' },
      { status: 400 },
    );
  }

  const origin = checkoutReturnOrigin(request);
  const successUrl =
    body.successUrl?.trim() || `${origin}/usage?topup=succeeded`;
  const cancelUrl = body.cancelUrl?.trim() || `${origin}/usage?topup=canceled`;

  try {
    const result = await startDashboardWalletTopUp({
      amountUsd,
      externalUserId,
      successUrl,
      cancelUrl,
    });
    return NextResponse.json(result);
  } catch (error) {
    return walletErrorResponse(error, "Failed to start top-up checkout");
  }
}
