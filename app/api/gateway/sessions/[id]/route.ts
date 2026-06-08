import { createGatewayStopSessionHandler } from "@pymthouse/builder-sdk/gateway/server";
import { readDashboardGatewayConfig } from "@/lib/dashboard/gateway-config.server";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const config = readDashboardGatewayConfig(request);
  return createGatewayStopSessionHandler(config)(request, context);
}
