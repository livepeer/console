import { NextRequest, NextResponse } from "next/server";
import { PmtHouseError } from "@pymthouse/builder-sdk";
import { fetchAccountUsageForExternalUser } from "@/lib/dashboard/pymthouse-bff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Usage/balance is live data; never let the browser or any CDN replay a stale
// response (the balance would otherwise freeze at the first cached read).
const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" } as const;

export async function GET(request: NextRequest) {
  const externalUserId = request.nextUrl.searchParams.get("externalUserId")?.trim();
  if (!externalUserId) {
    return NextResponse.json(
      { error: "externalUserId is required" },
      { status: 400 },
    );
  }

  const windowRaw = request.nextUrl.searchParams.get("window")?.trim().toLowerCase();
  const window =
    windowRaw === "mtd" || windowRaw === "rolling" ? windowRaw : "rolling";

  const rawDays = request.nextUrl.searchParams.get("days");
  const periodDays = rawDays ? Number.parseInt(rawDays, 10) : 30;
  if (window === "rolling" && (!Number.isFinite(periodDays) || periodDays < 1 || periodDays > 90)) {
    return NextResponse.json(
      { error: "days must be between 1 and 90" },
      { status: 400 },
    );
  }

  const includePriorRaw = request.nextUrl.searchParams.get("includePrior");
  const includePrior =
    includePriorRaw == null ? true : !["0", "false", "no"].includes(includePriorRaw.toLowerCase());

  try {
    const payload = await fetchAccountUsageForExternalUser({
      externalUserId,
      periodDays,
      window,
      includePrior,
    });
    return NextResponse.json(payload, { headers: NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof PmtHouseError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status, headers: NO_STORE_HEADERS },
      );
    }
    const message = error instanceof Error ? error.message : "Usage fetch failed";
    return NextResponse.json(
      { error: message },
      { status: 502, headers: NO_STORE_HEADERS },
    );
  }
}
