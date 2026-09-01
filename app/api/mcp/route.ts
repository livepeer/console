import { NextRequest } from "next/server";
import {
  handleMcpRequest,
  identityResponse,
  optionsResponse
} from "@/lib/mcp/mcp-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

export function OPTIONS(req: NextRequest) {
  return optionsResponse(req);
}

export async function GET(req: NextRequest) {
  const accept = req.headers.get("accept") || "";
  if (!accept.includes("text/event-stream")) {
    return identityResponse(req);
  }
  return handleMcpRequest(req);
}

export async function POST(req: NextRequest) {
  return handleMcpRequest(req);
}

export async function DELETE(req: NextRequest) {
  return handleMcpRequest(req);
}
