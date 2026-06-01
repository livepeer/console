import type { Model } from "@/lib/dashboard/types";

/** Public Dashboard origin used in SDK examples (device exchange facade). */
export function getDashboardFacadeOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_DASHBOARD_ORIGIN?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "http://localhost:3001";
}

/** OIDC issuer for RFC 8628 device login (Keycloak clearinghouse realm). */
export function getClearinghouseOidcIssuerUrl(): string {
  return (
    process.env.NEXT_PUBLIC_CLEARINGHOUSE_OIDC_ISSUER_URL?.trim() ||
    process.env.NEXT_PUBLIC_SIGNER_OIDC_ISSUER_URL?.trim() ||
    "http://127.0.0.1:8080/realms/clearinghouse"
  ).replace(/\/$/, "");
}

/** Public app client id for device authorization (app_*). */
export function getClearinghousePublicClientId(): string {
  return (
    process.env.NEXT_PUBLIC_CLEARINGHOUSE_PUBLIC_CLIENT_ID?.trim() || "app_demo"
  );
}

/** Apache DMZ / remote signer base for discovery and payment hot path. */
export function getClearinghouseSignerBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_CLEARINGHOUSE_API_URL?.trim() ||
    "http://127.0.0.1:8080"
  ).replace(/\/$/, "");
}

export function isStreamingCapabilityModel(model: Model): boolean {
  const id = model.id.toLowerCase();
  return (
    model.realtime === true ||
    id.includes("streamdiffusion") ||
    id.includes("live-video") ||
    model.category === "Live Transcoding"
  );
}

export function buildPythonSdkStreamingSnippet(model: Model): string {
  const dashboardOrigin = getDashboardFacadeOrigin();
  const issuerUrl = getClearinghouseOidcIssuerUrl();
  const publicClientId = getClearinghousePublicClientId();
  const signerBase = getClearinghouseSignerBaseUrl();
  const discoveryUrl = `${signerBase}/discover-orchestrators?cap=${encodeURIComponent(model.id)}`;
  const modelId = model.id.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  return `import asyncio

from livepeer_gateway.lv2v import StartJobRequest, start_lv2v
from livepeer_gateway.media_publish import MediaPublishConfig, VideoOutputConfig

# 1) Device login at the clearinghouse OIDC issuer (RFC 8628).
# 2) Exchange the user access token for a long-lived signer JWT via the Dashboard facade.
# 3) Stream with signer/discovery headers on the clearinghouse hot path.

DASHBOARD_ORIGIN = "${dashboardOrigin}"
OIDC_ISSUER_URL = "${issuerUrl}"
PUBLIC_CLIENT_ID = "${publicClientId}"
SIGNER_BASE_URL = "${signerBase}"
DISCOVERY_URL = "${discoveryUrl}"
MODEL_ID = "${modelId}"


async def main() -> None:
    job = start_lv2v(
        orch_url=None,
        req=StartJobRequest(model_id=MODEL_ID),
        billing_url=DASHBOARD_ORIGIN,
        issuer_url=OIDC_ISSUER_URL,
        signer_url=SIGNER_BASE_URL,
        discovery_url=DISCOVERY_URL,
        oidc_client_id=PUBLIC_CLIENT_ID,
        scope="sign:job openid profile",
        headless=True,
    )

    print("publish_url:", job.publish_url)
    print("subscribe_url:", job.subscribe_url)

    media = job.start_media(MediaPublishConfig(tracks=[VideoOutputConfig(fps=30.0)]))
    # await media.write_frame(frame)  # your frames here
    await job.close()


if __name__ == "__main__":
    asyncio.run(main())`;
}

export function getStreamingFacadeEndpointLabel(_model: Model): string {
  const origin = getDashboardFacadeOrigin();
  return `POST ${origin}/api/pymthouse/keys/exchange → POST ${origin}/api/gateway/sessions`;
}

export function buildGatewayStreamingSnippet(model: Model): string {
  const dashboardOrigin = getDashboardFacadeOrigin();
  const modelId = model.id.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  return `import { BrowserGatewayClient } from "@pymthouse/builder-sdk/gateway/client";

const DASHBOARD_ORIGIN = "${dashboardOrigin}";
const API_KEY = process.env.PMTH_API_KEY!; // pmth_* from Settings → API keys
const MODEL_ID = "${modelId}";

const client = new BrowserGatewayClient({ baseUrl: DASHBOARD_ORIGIN });

await client.connect({
  type: "apiKey",
  apiKey: API_KEY,
  facadeUrl: DASHBOARD_ORIGIN,
  scope: "sign:job",
});

const { sessionId, manifestId } = await client.startSession({ modelId: MODEL_ID });
console.log("session:", sessionId, "manifest:", manifestId);

// Publish JPEG segments (e.g. from canvas.toBlob) via same-origin relay:
// await client.publishSegment(bytes, { contentType: "image/jpeg" });

// Poll orchestrator output segments:
// const out = await client.subscribeSegment();

await client.stop();`;
}
