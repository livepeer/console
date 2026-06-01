/**
 * Client-safe gateway flags. Do not import gateway/server here — it uses Node gRPC.
 */

export function isGatewayEnabledPublic(): boolean {
  return process.env.NEXT_PUBLIC_GATEWAY_ENABLED === "1";
}
