export type RunCapabilityEndpointError = {
  error: "endpoint_not_supported" | "endpoint_required";
  message: string;
  capability: string;
  mode?: string | null;
};

export function validateRunCapabilityEndpoint(
  capability: string,
  row: { mode?: string } | null,
  endpoint?: string
): RunCapabilityEndpointError | null {
  if (endpoint?.trim()) {
    if (!row || row.mode !== "persistent") {
      return {
        error: "endpoint_not_supported",
        message:
          "endpoint is only valid for persistent capabilities; single-shot apps POST the discovery URL as published",
        capability,
        mode: row?.mode ?? null,
      };
    }
    return null;
  }
  if (row?.mode === "persistent") {
    return {
      error: "endpoint_required",
      message:
        "Persistent capabilities require endpoint (app path, e.g. /hello)",
      capability,
    };
  }
  return null;
}

function requestIdFromError(err: unknown): string {
  if (!err || typeof err !== "object" || !("gatewayRequestId" in err)) {
    return "";
  }
  const id = (err as { gatewayRequestId?: unknown }).gatewayRequestId;
  return typeof id === "string" ? id.trim() : "";
}

export function runCapabilityFailurePayload(
  err: unknown,
  mintedId: string
): { error: string; gateway_request_id: string } {
  return {
    error: err instanceof Error ? err.message : String(err),
    gateway_request_id: requestIdFromError(err) || mintedId,
  };
}
