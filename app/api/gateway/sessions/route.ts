import { createGatewayStartSessionHandler } from "@pymthouse/builder-sdk/gateway/server";
import { readDashboardGatewayConfig } from "@/lib/dashboard/gateway-config.server";

const config = readDashboardGatewayConfig();
const handler = createGatewayStartSessionHandler(config);

export const POST = handler;
