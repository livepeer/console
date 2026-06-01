import { createGatewayStopSessionHandler } from "@pymthouse/builder-sdk/gateway/server";
import { readDashboardGatewayConfig } from "@/lib/dashboard/gateway-config.server";

const config = readDashboardGatewayConfig();
const handler = createGatewayStopSessionHandler(config);

export const DELETE = handler;
