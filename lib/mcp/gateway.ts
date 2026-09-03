import {
  createGateway,
  type InferenceRequest,
  type InferenceResult,
} from "@pymthouse/gateway-web";
import { pymthouseSignerUrl } from "./env";
import type { McpPrincipal } from "./jwt";
import { resolveSignerSession } from "./signer-exchange";

export async function runInference(
  principal: McpPrincipal,
  request: InferenceRequest
): Promise<InferenceResult> {
  const session = await resolveSignerSession(principal);
  const timeoutMs = request.timeoutMs ?? request.timeout ?? 120_000;
  let seeded: typeof session | null = session;

  const gw = createGateway({
    signerUrl: session.signer_url || pymthouseSignerUrl(),
    discoveryUrl: session.discovery_url,
    signerHeaders: async () => {
      const next = seeded ?? (await resolveSignerSession(principal));
      seeded = null;
      return {
        headers: { Authorization: `Bearer ${next.access_token}` },
        expiresInSeconds: next.expires_in,
      };
    },
    insecureTls: true,
    timeoutMs,
    attributionSource: "pymthouse_gateway",
  });
  return gw.runInference(request);
}
