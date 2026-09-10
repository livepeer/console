import { NextRequest, NextResponse } from "next/server";
import { fetchAccountUsageForExternalUser } from "@/lib/console/pymthouse-bff";
import { requireConsoleSession } from "@/lib/console/session-user";
import {
  PYMTHOUSE_NO_STORE_HEADERS,
  pymthouseErrorResponse,
} from "@/app/api/pymthouse/route-helpers";
import {
  previewAccountUsage,
  previewFixturesEnabled,
} from "@/lib/runs/preview-fixtures";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const windowRaw = request.nextUrl.searchParams
    .get("window")
    ?.trim()
    .toLowerCase();
  const window =
    windowRaw === "mtd" || windowRaw === "rolling" ? windowRaw : "rolling";

  const rawDays = request.nextUrl.searchParams.get("days");
  const periodDays = rawDays ? Number.parseInt(rawDays, 10) : 30;
  if (
    window === "rolling" &&
    (!Number.isFinite(periodDays) || periodDays < 1 || periodDays > 90)
  ) {
    return NextResponse.json(
      { error: "days must be between 1 and 90" },
      { status: 400, headers: PYMTHOUSE_NO_STORE_HEADERS }
    );
  }

  const includePriorRaw = request.nextUrl.searchParams.get("includePrior");
  const includePrior =
    includePriorRaw == null
      ? true
      : !["0", "false", "no"].includes(includePriorRaw.toLowerCase());

  try {
    const session = await requireConsoleSession();
    if (previewFixturesEnabled()) {
      return NextResponse.json(
        previewAccountUsage({
          externalUserId: session.externalUserId,
          periodDays,
          window,
          includePrior,
        }),
        { headers: PYMTHOUSE_NO_STORE_HEADERS }
      );
    }
    const payload = await fetchAccountUsageForExternalUser({
      externalUserId: session.externalUserId,
      periodDays,
      window,
      includePrior,
    });
    return NextResponse.json(payload, { headers: PYMTHOUSE_NO_STORE_HEADERS });
  } catch (error) {
    return pymthouseErrorResponse(error, "Usage fetch failed");
  }
}
