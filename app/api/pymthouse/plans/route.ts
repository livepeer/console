import { NextResponse } from "next/server";
import { PmtHouseError } from "@pymthouse/builder-sdk";
import { listDashboardBillingPlans } from "@/lib/console/pymthouse-billing-bff";

export const runtime = "nodejs";

export async function GET() {
  try {
    const plans = await listDashboardBillingPlans();
    return NextResponse.json({ plans });
  } catch (error) {
    if (error instanceof PmtHouseError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    const message =
      error instanceof Error ? error.message : "Failed to list billing plans";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
