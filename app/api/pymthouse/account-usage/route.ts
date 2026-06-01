import { NextRequest, NextResponse } from "next/server";
import { PmtHouseError } from "@pymthouse/builder-sdk";
import { fetchAccountUsageForExternalUser } from "@/lib/dashboard/pymthouse-bff";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const externalUserId = request.nextUrl.searchParams.get("externalUserId")?.trim();
  if (!externalUserId) {
    return NextResponse.json(
      { error: "externalUserId is required" },
      { status: 400 },
    );
  }

  const rawDays = request.nextUrl.searchParams.get("days");
  const periodDays = rawDays ? Number.parseInt(rawDays, 10) : 30;
  if (!Number.isFinite(periodDays) || periodDays < 1 || periodDays > 90) {
    return NextResponse.json(
      { error: "days must be between 1 and 90" },
      { status: 400 },
    );
  }

  try {
    const payload = await fetchAccountUsageForExternalUser({
      externalUserId,
      periodDays,
    });
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof PmtHouseError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    const message = error instanceof Error ? error.message : "Usage fetch failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
