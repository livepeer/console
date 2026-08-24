import type { AccountActivityRow, PipelineKind } from "@/lib/console/types";
import type { SignedTicketRequestRow } from "@/lib/console/account-usage";
import {
  humanizePipelineModel,
  microsToUsdDisplay,
} from "@/lib/console/usage-capability-display";

const LIVE_PIPELINES = new Set([
  "video-to-video",
  "live-video-to-video",
  "live-transcoding",
]);

function inferKind(pipeline: string): PipelineKind {
  return LIVE_PIPELINES.has(pipeline) ? "live" : "batch";
}

/** Map PymtHouse signed-ticket rows into the /calls table shape. */
export function mapSignedTicketToActivityRow(
  row: SignedTicketRequestRow
): AccountActivityRow {
  const kind = inferKind(row.pipeline);
  const model = humanizePipelineModel(row.pipeline, row.modelId);
  const fee = microsToUsdDisplay(row.networkFeeUsdMicros || "0");

  return {
    id: row.gatewayRequestId || row.eventId,
    environmentId: "env-production",
    timestamp: row.time,
    model,
    pipeline: row.pipeline,
    status: "success",
    kind,
    latencyMs: null,
    durationMs: null,
    signer: "paymthouse",
    signerLabel: row.appName?.trim() || "PymtHouse",
    tokenId: "",
    tokenName: "",
    costDisplay: `$${fee}`,
  };
}
