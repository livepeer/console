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

function stringField(err: unknown, key: string): string {
  if (!err || typeof err !== "object" || !(key in err)) {
    return "";
  }
  const value = (err as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

export function runCapabilityFailurePayload(
  err: unknown,
  mintedId: string
): {
  error: string;
  gateway_request_id: string;
  request_id?: string;
} {
  const providerRequestId = stringField(err, "providerRequestId");
  return {
    error: err instanceof Error ? err.message : String(err),
    gateway_request_id: stringField(err, "gatewayRequestId") || mintedId,
    ...(providerRequestId ? { request_id: providerRequestId } : {}),
  };
}
