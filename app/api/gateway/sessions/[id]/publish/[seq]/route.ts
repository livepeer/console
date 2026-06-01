import { createGatewayPublishSegmentHandler } from "@pymthouse/builder-sdk/gateway/server";
import { readDashboardGatewayConfig } from "@/lib/dashboard/gateway-config.server";

const config = readDashboardGatewayConfig();
const handler = createGatewayPublishSegmentHandler(config);

export const PUT = handler;
export const POST = handler;
