import { NextRequest, NextResponse } from "next/server";
import { PmtHouseError } from "@pymthouse/builder-sdk";
import {
  forwardRunnerRequest,
  isRunnerGatewayConfigured,
  RunnerGatewayError,
} from "@/lib/runner-gateway";
import { isRunnerSignerConfigured } from "@/lib/dashboard/signer-session-bff";
import "@/lib/runner-gateway/tls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" } as const;

function readExternalUserId(request: NextRequest): string {
  return (
    request.headers.get("x-external-user-id")?.trim() ||
    request.nextUrl.searchParams.get("externalUserId")?.trim() ||
    ""
  );
}

function readRunnerApp(request: NextRequest): string {
  return (
    request.nextUrl.searchParams.get("app")?.trim() ||
    request.headers.get("x-runner-app")?.trim() ||
    ""
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  if (!isRunnerGatewayConfigured()) {
    return NextResponse.json(
      {
        error: "server_misconfigured",
        error_description: "RUNNER_DISCOVERY_URL is required",
        code: "runner_misconfigured",
      },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  const externalUserId = readExternalUserId(request);
  if (!externalUserId) {
    return NextResponse.json(
      { error: "x-external-user-id is required", code: "unauthorized" },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  const appId = readRunnerApp(request);
  if (!appId) {
    return NextResponse.json(
      { error: "app query parameter or x-runner-app header is required", code: "invalid_app" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  if (!isRunnerSignerConfigured()) {
    // Offchain path: signer optional when PymtHouse is not configured.
  }

  const { path } = await context.params;
  const runnerPath = path.join("/");

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("invalid body");
    }
  } catch {
    return NextResponse.json(
      { error: "Request body must be a JSON object", code: "invalid_body" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const discoveryUrl = process.env.RUNNER_DISCOVERY_URL!.trim();

  try {
    const response = await forwardRunnerRequest({
      externalUserId,
      appId,
      runnerPath,
      payload,
      discoveryUrl,
    });
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store, max-age=0");
    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    if (error instanceof RunnerGatewayError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status, headers: NO_STORE_HEADERS },
      );
    }
    if (error instanceof PmtHouseError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status, headers: NO_STORE_HEADERS },
      );
    }
    const message = error instanceof Error ? error.message : "Runner gateway failed";
    return NextResponse.json(
      { error: message, code: "runner_error" },
      { status: 502, headers: NO_STORE_HEADERS },
    );
  }
}
