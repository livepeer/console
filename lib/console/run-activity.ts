import type { RunDetail, RunSummary } from "@/lib/runs/types";
import type { AccountActivityRow } from "./types";
import { resolveActivityCapability } from "./capability-modality";
import {
  requestFeeDisplay,
  type RequestFeeFields,
} from "./request-fee-display";
import { humanizePipelineModel } from "./usage-capability-display";

function costFromFee(
  fee: RequestFeeFields | null | undefined
): { costDisplay: string; costExact: string } | null {
  if (!fee || typeof fee !== "object") return null;
  const { display, exact } = requestFeeDisplay(fee);
  return { costDisplay: display, costExact: exact };
}

export function runToActivity(run: RunSummary | RunDetail): AccountActivityRow {
  const capability = resolveActivityCapability({
    pipeline: run.capability,
    capabilityId: run.modelId ?? run.capability,
  });
  const elapsed =
    run.startedAt && run.completedAt
      ? Date.parse(run.completedAt) - Date.parse(run.startedAt)
      : null;
  const cost = costFromFee(run.billing);
  return {
    id: run.id,
    recordKind: "run",
    gatewayRequestId: run.gatewayRequestId,
    environmentId: "console",
    timestamp: run.createdAt,
    model: humanizePipelineModel(
      capability.pipeline,
      run.modelId ?? run.capability
    ),
    pipeline: capability.pipeline,
    modality: capability.modality,
    status: run.status === "succeeded" ? "success" : run.status,
    kind: "batch",
    latencyMs: elapsed,
    durationMs: null,
    signer: "paymthouse",
    signerLabel: run.source === "mcp" ? "MCP" : run.source,
    tokenId: "",
    tokenName: "",
    costDisplay: cost?.costDisplay ?? "—",
    ...(cost?.costExact ? { costExact: cost.costExact } : {}),
    providerRequestId: run.providerRequestId ?? undefined,
  };
}
