import { forwardSignerProxyRequest } from "@/lib/dashboard/signer-proxy.server";

type RouteContext = { params: Promise<{ path: string[] }> };

async function handle(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  return forwardSignerProxyRequest(request, path);
}

export const GET = handle;
export const POST = handle;
