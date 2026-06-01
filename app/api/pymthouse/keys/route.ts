import { NextRequest, NextResponse } from "next/server";
import { PmtHouseError } from "@pymthouse/builder-sdk";
import {
  createDashboardApiKey,
  listDashboardApiKeys,
  revokeDashboardApiKey,
} from "@/lib/dashboard/pymthouse-keys-bff";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const externalUserId = request.nextUrl.searchParams.get("externalUserId")?.trim();
  if (!externalUserId) {
    return NextResponse.json(
      { error: "externalUserId is required" },
      { status: 400 },
    );
  }

  try {
    const keys = await listDashboardApiKeys(externalUserId);
    return NextResponse.json({ keys });
  } catch (error) {
    if (error instanceof PmtHouseError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    const message = error instanceof Error ? error.message : "Failed to list API keys";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  let body: { externalUserId?: string; label?: string };
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
    const created = await createDashboardApiKey({
      externalUserId,
      label: body.label,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof PmtHouseError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    const message = error instanceof Error ? error.message : "Failed to create API key";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest) {
  const externalUserId = request.nextUrl.searchParams.get("externalUserId")?.trim();
  const keyId = request.nextUrl.searchParams.get("keyId")?.trim();
  if (!externalUserId || !keyId) {
    return NextResponse.json(
      { error: "externalUserId and keyId are required" },
      { status: 400 },
    );
  }

  try {
    await revokeDashboardApiKey({ externalUserId, keyId });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof PmtHouseError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    const message = error instanceof Error ? error.message : "Failed to revoke API key";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
