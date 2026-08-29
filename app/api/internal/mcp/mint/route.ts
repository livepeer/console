import { NextRequest, NextResponse } from "next/server";

import { PmtHouseError } from "@pymthouse/builder-sdk";
import {
  authorizeMcpMint,
  billingAppMismatch,
  mintMcpUserTokens,
  mintRouteConfigured,
} from "@/lib/console/mcp-internal-mint";
import { resolveMcpMintSubject } from "@/lib/console/mcp-oauth-login-bridge";

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

  let body: {
    code?: unknown;
    externalUserId?: unknown;
    email?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json(400, { error: "invalid_request", error_description: "invalid_json" });
  }

  const subject = resolveMcpMintSubject(body);
  if (!subject.ok) {
    return json(subject.status, {
      error: subject.error,
      error_description: subject.error_description,
    });
  }

  try {
    const minted = await mintMcpUserTokens({
      externalUserId: subject.externalUserId,
      email: subject.email,
    });
    return json(200, minted);
  } catch (error) {
    if (error instanceof PmtHouseError && (error.status === 400 || error.status === 401)) {
      return json(error.status, { error: "invalid_request" });
    }
    return json(502, {
      error: "mint_failed",
      error_description: "Unable to mint credential",
    });
  }
}
