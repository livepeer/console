import {
  createGateway,
  SignerRefreshRequired,
  type InferenceRequest,
  type InferenceResult
} from "@pymthouse/gateway-web";
import { discoveryServiceUrl, pymthouseSignerUrl } from "./env";
import type { McpPrincipal } from "./jwt";
import { exchangeUserJwtForSignerJwt } from "./signer-exchange";

const SLOW_MS = 90_000;

export async function runInference(
  principal: McpPrincipal,
  request: InferenceRequest
): Promise<InferenceResult> {
  let session = await exchangeUserJwtForSignerJwt(principal);
  const timeoutMs = request.timeoutMs ?? request.timeout ?? 120_000;

  const attempt = async (signerJwt: string) => {
    const gw = createGateway({
      signerUrl: session.signer_url || pymthouseSignerUrl(),
      signerHeaders: { Authorization: `Bearer ${signerJwt}` },
      discoveryUrl: session.discovery_url || discoveryServiceUrl(),
      insecureTls: true,
      timeoutMs
    });
    return gw.runInference(request);
  };

  try {
    return await attempt(session.access_token);
  } catch (err) {
    if (err instanceof SignerRefreshRequired) {
      session = await exchangeUserJwtForSignerJwt(principal);
      return attempt(session.access_token);
    }
    throw err;
  }
}

export function isSlowCapability(capability: string): boolean {
  const cap = capability.toLowerCase();
  return (
    cap.includes("video") ||
    cap.includes("i2v") ||
    cap.includes("t2v") ||
    cap.includes("kling") ||
    cap.includes("seedance") ||
    cap.includes("wan") ||
    cap.includes("ltx")
  );
}

export { SLOW_MS };
