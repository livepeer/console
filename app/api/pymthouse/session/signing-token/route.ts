import { NextRequest, NextResponse } from "next/server";
import { PmtHouseError } from "@pymthouse/builder-sdk";
import { mintDashboardUserSigningToken } from "@/lib/dashboard/pymthouse-signing-bff";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: { externalUserId?: string; scope?: string };
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

  try {
    const minted = await mintDashboardUserSigningToken({
      externalUserId,
      scope: body.scope,
    });
    return NextResponse.json(minted, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof PmtHouseError) {
      return NextResponse.json(
        { error: error.code, error_description: error.message },
        { status: error.status },
      );
    }
    const message = error instanceof Error ? error.message : "Signing token mint failed";
    return NextResponse.json(
      { error: "signing_token_mint_failed", error_description: message },
      { status: 502 },
    );
  }
}
