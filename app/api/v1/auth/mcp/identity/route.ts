import { NextRequest, NextResponse } from "next/server";

import { redeemMcpIdentityCode } from "@/lib/console/mcp-oauth-login-bridge";

export const runtime = "nodejs";

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  let body: { code?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json(400, { error: "invalid_request", error_description: "invalid_json" });
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) {
    return json(400, { error: "invalid_request", error_description: "code is required" });
  }

  const grant = redeemMcpIdentityCode(code);
  if (!grant) {
    return json(401, { error: "unauthorized", error_description: "invalid or expired code" });
  }

  return json(200, {
    externalUserId: grant.externalUserId,
    ...(grant.email ? { email: grant.email } : {}),
  });
}
