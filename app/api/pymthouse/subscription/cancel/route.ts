import { NextRequest, NextResponse } from "next/server";
import { PmtHouseError } from "@pymthouse/builder-sdk";
import { cancelDashboardUserSubscription } from "@/lib/console/pymthouse-billing-bff";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: {
    externalUserId?: string;
    timing?: string;
    effectiveAt?: string;
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
      { status: 400 }
    );
  }

  try {
    await cancelDashboardUserSubscription(externalUserId, {
      timing: body.timing?.trim(),
      effectiveAt: body.effectiveAt?.trim(),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PmtHouseError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    const message =
      error instanceof Error ? error.message : "Failed to cancel subscription";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
