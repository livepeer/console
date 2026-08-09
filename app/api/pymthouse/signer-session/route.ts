import { NextRequest, NextResponse } from "next/server";
import { PmtHouseError } from "@pymthouse/builder-sdk";
import {
  getSignerSessionStatus,
  isRunnerSignerConfigured,
} from "@/lib/dashboard/signer-session-bff";
import { isRunnerGatewayConfigured } from "@/lib/runner-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" } as const;

export async function POST(request: NextRequest) {
  if (!isRunnerGatewayConfigured()) {
    return NextResponse.json(
      {
        error: "server_misconfigured",
        error_description: "RUNNER_DISCOVERY_URL is required",
      },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  if (!isRunnerSignerConfigured()) {
    // Offchain path: no JWT to mint — playground can still hit local runners.
    return NextResponse.json(
      {
        ready: true,
        expiresIn: 0,
        balanceUsdMicros: "0",
        lifetimeGrantedUsdMicros: "0",
        jwt: "",
      },
      { headers: NO_STORE_HEADERS },
    );
  }

  let externalUserId = request.nextUrl.searchParams.get("externalUserId")?.trim() ?? "";
  if (!externalUserId) {
    try {
      const body = (await request.json()) as { externalUserId?: string };
      externalUserId = body.externalUserId?.trim() ?? "";
    } catch {
      // ignore — query param is the primary interface
    }
  }

  if (!externalUserId) {
    return NextResponse.json(
      { error: "externalUserId is required" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const status = await getSignerSessionStatus(externalUserId);
    return NextResponse.json(status, { headers: NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof PmtHouseError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status, headers: NO_STORE_HEADERS },
      );
    }
    const message = error instanceof Error ? error.message : "Signer session failed";
    return NextResponse.json(
      { error: message },
      { status: 502, headers: NO_STORE_HEADERS },
    );
  }
}
