import { NextRequest, NextResponse } from "next/server";
import {
  createDashboardApiKey,
  listDashboardApiKeys,
  revokeDashboardApiKey,
} from "@/lib/console/pymthouse-keys-bff";
import { requireConsoleSession } from "@/lib/console/session-user";
import {
  PYMTHOUSE_NO_STORE_HEADERS,
  pymthouseErrorResponse,
} from "@/app/api/pymthouse/route-helpers";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireConsoleSession();
    const keys = await listDashboardApiKeys(
      session.externalUserId,
      session.email
    );
    return NextResponse.json({ keys }, { headers: PYMTHOUSE_NO_STORE_HEADERS });
  } catch (error) {
    return pymthouseErrorResponse(error, "Failed to list API keys");
  }
}

export async function POST(request: NextRequest) {
  let body: { label?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    const session = await requireConsoleSession();
    const created = await createDashboardApiKey({
      externalUserId: session.externalUserId,
      email: session.email,
      label: body.label,
    });
    return NextResponse.json(created, {
      status: 201,
      headers: PYMTHOUSE_NO_STORE_HEADERS,
    });
  } catch (error) {
    return pymthouseErrorResponse(error, "Failed to create API key");
  }
}

export async function DELETE(request: NextRequest) {
  const keyId = request.nextUrl.searchParams.get("keyId")?.trim();
  if (!keyId) {
    return NextResponse.json({ error: "keyId is required" }, { status: 400 });
  }

  try {
    const session = await requireConsoleSession();
    await revokeDashboardApiKey({
      externalUserId: session.externalUserId,
      keyId,
    });
    return NextResponse.json(
      { success: true },
      { headers: PYMTHOUSE_NO_STORE_HEADERS }
    );
  } catch (error) {
    return pymthouseErrorResponse(error, "Failed to revoke API key");
  }
}
