import {
  createGateway,
  SignerRefreshRequired,
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
  let session = await resolveSignerSession(principal);
  const timeoutMs =
    request.timeoutMs ??
    (typeof request.timeout === "number" ? request.timeout * 1000 : 120_000);

  const attempt = async (signerJwt: string) => {
    const gw = createGateway({
      signerUrl: session.signer_url || pymthouseSignerUrl(),
      signerHeaders: { Authorization: `Bearer ${signerJwt}` },
      discoveryUrl: session.discovery_url,
      insecureTls: true,
      timeoutMs,
      attributionSource: "pymthouse_gateway",
    });
    return gw.runInference(request);
  };

  try {
    return await attempt(session.access_token);
  } catch (err) {
    if (err instanceof SignerRefreshRequired) {
      session = await resolveSignerSession(principal);
      return attempt(session.access_token);
    }
    throw err;
  }
}
