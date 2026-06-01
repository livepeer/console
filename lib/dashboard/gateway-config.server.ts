import "server-only";

import {
  readGatewayConfigFromEnv,
  type GatewayServerConfig,
} from "@pymthouse/builder-sdk/gateway/server";

export type { GatewayServerConfig };

export function readDashboardGatewayConfig(): GatewayServerConfig | null {
  return readGatewayConfigFromEnv(process.env);
}
