import { NextRequest, NextResponse } from "next/server";

import { PmtHouseError } from "@pymthouse/builder-sdk";
import {
  authorizeMcpMint,
  billingAppMismatch,
  exchangeMcpSignerSession,
  mintRouteConfigured,
} from "@/lib/console/mcp-internal-mint";

export const runtime = "nodejs";

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  if (!mintRouteConfigured()) {
    return json(404, { error: "not_found" });
  }

  const auth = authorizeMcpMint({
    authorization: request.headers.get("authorization"),
    origin: request.headers.get("origin"),
    callerOrigin: request.headers.get("x-mcp-caller-origin"),
  });
  if (!auth.ok) {
    return json(auth.status, { error: auth.error });
  }

  const mismatch = billingAppMismatch();
  if (mismatch) {
    return json(503, mismatch);
  }

  let body: { access_token?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json(400, { error: "invalid_request", error_description: "invalid_json" });
  }

  const accessToken =
    typeof body.access_token === "string" ? body.access_token.trim() : "";
  if (!accessToken) {
    return json(400, {
      error: "invalid_request",
      error_description: "access_token is required",
    });
  }

  try {
    const session = await exchangeMcpSignerSession({ accessToken });
    return json(200, session);
  } catch (error) {
    if (error instanceof PmtHouseError && (error.status === 400 || error.status === 401)) {
      return json(error.status, { error: "invalid_grant" });
    }
    return json(502, {
      error: "signer_exchange_failed",
      error_description: "Unable to mint signer session",
    });
  }
}
