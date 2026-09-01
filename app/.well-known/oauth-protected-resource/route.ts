export const runtime = "edge";
export const revalidate = 60;

import {
  prmBody,
  wellKnownJsonResponse,
  wellKnownOptionsResponse
} from "@/lib/mcp/oauth";

export async function GET(req: Request): Promise<Response> {
  return wellKnownJsonResponse(req, prmBody(req));
}

export function OPTIONS(req: Request): Response {
  return wellKnownOptionsResponse(req);
}
