import { NextRequest, NextResponse } from "next/server";
import { PmtHouseError } from "@pymthouse/builder-sdk";
import {
  clearDeviceFlowCookie,
  completeDashboardDeviceApproval,
  readDeviceFlowCookie,
} from "@/lib/dashboard/device-flow";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const deviceFlow = await readDeviceFlowCookie();
  if (!deviceFlow) {
    return NextResponse.json(
      { error: "no_pending_device_flow" },
      { status: 400 },
    );
  }

  let body: { externalUserId?: string; email?: string; name?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const email = body.email?.trim() ?? "";
  const externalUserId = body.externalUserId?.trim() || email;
  if (!externalUserId) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "email is required" },
      { status: 400 },
    );
  }

  try {
    await completeDashboardDeviceApproval({
      userCode: deviceFlow.userCode,
      publicClientId: deviceFlow.clientId,
      externalUserId,
      email: email || externalUserId,
    });

    await clearDeviceFlowCookie();

    return NextResponse.json({
      success: true,
      redirectTo: "/device-approved",
    });
  } catch (error) {
    console.error("Device approval completion failed", error);
    if (error instanceof PmtHouseError) {
      return NextResponse.json(
        {
          error: error.code,
          error_description: error.message,
        },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        error: "device_approval_failed",
        error_description:
          error instanceof Error ? error.message : "Unknown device approval error",
      },
      { status: 500 },
    );
  }
}
