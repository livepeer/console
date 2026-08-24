import { NextRequest, NextResponse } from "next/server";
import { PmtHouseError } from "@pymthouse/builder-sdk";
import { resumeDashboardUserSubscription } from "@/lib/console/pymthouse-billing-bff";

export const runtime = "nodejs";

/**
 * The SDK derives `PmtHouseError.code` from the upstream error *message*, so
 * the machine-readable code (e.g. `nothing_to_resume`) only survives on
 * `details`. Prefer it so clients can branch on the code.
 */
function upstreamCode(error: PmtHouseError): string {
  const details = error.details;
  if (details && typeof details === "object" && "code" in details) {
    const code = (details as { code?: unknown }).code;
    if (typeof code === "string" && code.trim()) return code;
  }
  return error.code;
}

export async function POST(request: NextRequest) {
  let body: { externalUserId?: string };
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
    await resumeDashboardUserSubscription(externalUserId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PmtHouseError) {
      return NextResponse.json(
        { error: error.message, code: upstreamCode(error) },
        { status: error.status }
      );
    }
    const message =
      error instanceof Error ? error.message : "Failed to resume subscription";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
