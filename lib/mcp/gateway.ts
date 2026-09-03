import {
  createGateway,
  SignerRefreshRequired,
  capabilityMediaKind,
  extractMediaUrl,
  type InferenceRequest,
  type InferenceResult,
} from "@pymthouse/gateway-web";
import { pymthouseSignerUrl } from "./env";
import type { McpPrincipal } from "./jwt";
import { awaitQueuedResult, isQueueControlUrl } from "./queue";
import { resolveSignerSession } from "./signer-exchange";

export type InferenceProgress = {
  status: string;
  elapsedMs: number;
  requestId: string | null;
  statusUrl: string | null;
};

export type McpInferenceRequest = InferenceRequest & {
  onProgress?: (info: InferenceProgress) => void | Promise<void>;
};

function withSettledMedia(
  result: InferenceResult,
  data: Record<string, unknown>,
  capability: string
): InferenceResult {
  const url = extractMediaUrl(data) ?? extractMediaUrl({ data });
  const kind = capabilityMediaKind(capability);
  const queuedUrl = url && isQueueControlUrl(url) ? null : url;
  return {
    ...result,
    data,
    url: queuedUrl,
    imageUrl: kind === "image" ? queuedUrl : null,
    videoUrl: kind === "video" ? queuedUrl : null,
    audioUrl: kind === "audio" ? queuedUrl : null,
  };
}

export async function runInference(
  principal: McpPrincipal,
  request: McpInferenceRequest
): Promise<InferenceResult> {
  let session = await resolveSignerSession(principal);
  const timeoutMs = request.timeoutMs ?? request.timeout ?? 120_000;
  const t0 = Date.now();

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

  const run = async (): Promise<InferenceResult> => {
    try {
      return await attempt(session.access_token);
    } catch (err) {
      if (err instanceof SignerRefreshRequired) {
        session = await resolveSignerSession(principal);
        return attempt(session.access_token);
      }
      throw err;
    }
  };

  const result = await run();
  if (result.url && !isQueueControlUrl(result.url)) return result;

  const remainingMs = Math.max(1, timeoutMs - (Date.now() - t0));
  const data = await awaitQueuedResult(result.data, {
    timeoutMs: remainingMs,
    onProgress: request.onProgress,
  });
  return withSettledMedia(result, data, request.capability);
}
