import "server-only";

/**
 * Local/dev orchestrators (e.g. kiloutcorp.link) often present self-signed TLS.
 * When RUNNER_GATEWAY_ALLOW_INSECURE_TLS=1, Node's fetch will accept those certs.
 * Do not enable in production.
 */
export function applyRunnerGatewayTlsPolicy(): void {
  if (process.env.RUNNER_GATEWAY_ALLOW_INSECURE_TLS === "1") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }
}

applyRunnerGatewayTlsPolicy();
