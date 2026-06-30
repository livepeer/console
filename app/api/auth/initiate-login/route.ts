import { NextRequest, NextResponse } from "next/server";
import {
  extractDeviceApprovalFromTargetLink,
  validateDeviceInitiateLogin,
} from "@pymthouse/builder-sdk/device-initiate";
import { setDeviceFlowCookie } from "@/lib/dashboard/device-flow";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const issuerUrl = process.env.PYMTHOUSE_ISSUER_URL?.trim();
  if (!issuerUrl) {
    return NextResponse.json(
      {
        error: "server_misconfigured",
        error_description: "PYMTHOUSE_ISSUER_URL is required",
      },
      { status: 503 },
    );
  }

  const iss = request.nextUrl.searchParams.get("iss")?.trim() ?? "";
  const targetLinkUri =
    request.nextUrl.searchParams.get("target_link_uri")?.trim() ?? "";

  const validation = validateDeviceInitiateLogin({
    expectedIssuerUrl: issuerUrl,
    iss,
    targetLinkUri,
  });
  if (!validation.ok) {
    return NextResponse.json(
      { error: "invalid_request", error_description: validation.reason },
      { status: 400 },
    );
  }

  const extracted = extractDeviceApprovalFromTargetLink(targetLinkUri, {
    expectedIssuerUrl: issuerUrl,
  });
  if ("error" in extracted) {
    return NextResponse.json(
      { error: "invalid_request", error_description: extracted.error },
      { status: 400 },
    );
  }

  await setDeviceFlowCookie({
    iss,
    targetLinkUri,
    userCode: extracted.userCode,
    clientId: extracted.publicClientId,
  });

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("flow", "device");
  return NextResponse.redirect(loginUrl);
}
