import { createGatewaySubscribeSegmentHandler } from "@pymthouse/builder-sdk/gateway/server";
import { readDashboardGatewayConfig } from "@/lib/dashboard/gateway-config.server";

const config = readDashboardGatewayConfig();
const handler = createGatewaySubscribeSegmentHandler(config);

export const GET = handler;
