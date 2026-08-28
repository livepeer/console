import { NextRequest, NextResponse } from "next/server";
import {
  forwardRunnerRequest,
  isRunnerGatewayConfigured,
  RunnerGatewayError,
} from "@/lib/runner-gateway";
import { requireConsoleSession } from "@/lib/console/session-user";
import {
  PYMTHOUSE_NO_STORE_HEADERS,
  pymthouseErrorResponse,
} from "@/app/api/pymthouse/route-helpers";
import "@/lib/runner-gateway/tls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function readRunnerApp(request: NextRequest): string {
  return (
    request.nextUrl.searchParams.get("app")?.trim() ||
    request.headers.get("x-runner-app")?.trim() ||
    ""
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  if (!isRunnerGatewayConfigured()) {
    return NextResponse.json(
      {
        error: "server_misconfigured",
        error_description: "RUNNER_DISCOVERY_URL is required",
        code: "runner_misconfigured",
      },
      { status: 503, headers: PYMTHOUSE_NO_STORE_HEADERS }
    );
  }

  const appId = readRunnerApp(request);
  if (!appId) {
    return NextResponse.json(
      {
        error: "app query parameter or x-runner-app header is required",
        code: "invalid_app",
      },
      { status: 400, headers: PYMTHOUSE_NO_STORE_HEADERS }
    );
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
      { status: 400, headers: PYMTHOUSE_NO_STORE_HEADERS }
    );
  }

  const discoveryUrl = process.env.RUNNER_DISCOVERY_URL!.trim();

  try {
    const session = await requireConsoleSession();
    const response = await forwardRunnerRequest({
      externalUserId: session.externalUserId,
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
        { status: error.status, headers: PYMTHOUSE_NO_STORE_HEADERS }
      );
    }
    return pymthouseErrorResponse(error, "Runner gateway failed");
  }
}
