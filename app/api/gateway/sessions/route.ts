import { createGatewayStartSessionHandler } from "@pymthouse/builder-sdk/gateway/server";
import { readDashboardGatewayConfig } from "@/lib/dashboard/gateway-config.server";

export async function POST(request: Request) {
  const config = readDashboardGatewayConfig(request);
  return createGatewayStartSessionHandler(config)(request);
}
