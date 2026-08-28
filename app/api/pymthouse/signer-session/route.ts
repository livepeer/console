import { NextResponse } from "next/server";
import {
  getSignerSessionStatus,
  isRunnerSignerConfigured,
} from "@/lib/console/signer-session-bff";
import { requireConsoleSession } from "@/lib/console/session-user";
import { isRunnerGatewayConfigured } from "@/lib/runner-gateway";
import {
  PYMTHOUSE_NO_STORE_HEADERS,
  pymthouseErrorResponse,
} from "@/app/api/pymthouse/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (!isRunnerGatewayConfigured()) {
    return NextResponse.json(
      {
        error: "server_misconfigured",
        error_description: "RUNNER_DISCOVERY_URL is required",
      },
      { status: 503, headers: PYMTHOUSE_NO_STORE_HEADERS }
    );
  }

  try {
    if (!isRunnerSignerConfigured()) {
      await requireConsoleSession();
      return NextResponse.json(
        {
          ready: true,
          expiresIn: 0,
          balanceUsdMicros: "0",
          lifetimeGrantedUsdMicros: "0",
          jwt: "",
        },
        { headers: PYMTHOUSE_NO_STORE_HEADERS }
      );
    }

    const session = await requireConsoleSession();
    const status = await getSignerSessionStatus(session.externalUserId);
    return NextResponse.json(status, { headers: PYMTHOUSE_NO_STORE_HEADERS });
  } catch (error) {
    return pymthouseErrorResponse(error, "Signer session failed");
  }
}
