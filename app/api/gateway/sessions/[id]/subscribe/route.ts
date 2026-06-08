import { createGatewaySubscribeSegmentHandler } from "@pymthouse/builder-sdk/gateway/server";
import { readDashboardGatewayConfig } from "@/lib/dashboard/gateway-config.server";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const config = readDashboardGatewayConfig(request);
  return createGatewaySubscribeSegmentHandler(config)(request, context);
}
