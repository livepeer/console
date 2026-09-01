export const runtime = "edge";
export const revalidate = 60;

import {
  asMetadata,
  wellKnownJsonResponse,
  wellKnownOptionsResponse
} from "@/lib/mcp/oauth";

export async function GET(req: Request): Promise<Response> {
  return wellKnownJsonResponse(req, asMetadata(req));
}

export function OPTIONS(req: Request): Response {
  return wellKnownOptionsResponse(req);
}
