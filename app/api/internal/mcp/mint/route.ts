import { NextRequest, NextResponse } from "next/server";

import { PmtHouseError } from "@pymthouse/builder-sdk";
import {
  authorizeMcpMint,
  billingAppMismatch,
  mintMcpCompositeKey,
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

  let body: { externalUserId?: unknown; email?: unknown; label?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json(400, { error: "invalid_request", error_description: "invalid_json" });
  }

  const externalUserId =
    typeof body.externalUserId === "string" ? body.externalUserId.trim() : "";
  if (!externalUserId || externalUserId.length > 256) {
    return json(400, {
      error: "invalid_request",
      error_description: "externalUserId is required",
    });
  }

  try {
    const minted = await mintMcpCompositeKey({
      externalUserId,
      email: typeof body.email === "string" ? body.email.trim() : undefined,
      label: typeof body.label === "string" ? body.label : undefined,
    });
    return json(200, { apiKey: minted.apiKey });
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
