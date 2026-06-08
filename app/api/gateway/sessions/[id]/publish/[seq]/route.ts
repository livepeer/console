import { createGatewayPublishSegmentHandler } from "@pymthouse/builder-sdk/gateway/server";
import { readDashboardGatewayConfig } from "@/lib/dashboard/gateway-config.server";

async function handle(
  request: Request,
  context: { params: Promise<{ id: string; seq: string }> },
) {
  const config = readDashboardGatewayConfig(request);
  return createGatewayPublishSegmentHandler(config)(request, context);
}

export const PUT = handle;
export const POST = handle;
