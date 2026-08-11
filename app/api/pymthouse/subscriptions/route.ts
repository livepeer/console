import { NextRequest, NextResponse } from "next/server";
import { PmtHouseError } from "@pymthouse/builder-sdk";
import { listDashboardUserSubscriptions } from "@/lib/dashboard/pymthouse-billing-bff";

export const runtime = "nodejs";

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
    const result = await listDashboardUserSubscriptions(externalUserId);
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
        : "Failed to load subscription history";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
