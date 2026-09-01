import { discoveryOrigin } from "./env";

export type CapabilityRow = {
  name: string;
  pipeline?: string;
  model_id?: string;
  price?: unknown;
};

export async function listNetworkCapabilities(): Promise<CapabilityRow[]> {
  const origin = discoveryOrigin();
  const res = await fetch(`${origin}/v1/discovery/capabilities`, {
    headers: { Accept: "application/json" },
    cache: "no-store"
  });
  if (!res.ok) {
    throw new Error(`discovery capabilities failed (${res.status})`);
  }
  const json = (await res.json()) as { capabilities?: CapabilityRow[] } | CapabilityRow[];
  if (Array.isArray(json)) return json;
  return json.capabilities ?? [];
}

export async function describeNetworkCapability(
  name: string
): Promise<CapabilityRow | null> {
  const all = await listNetworkCapabilities();
  const needle = name.trim().toLowerCase();
  return (
    all.find((c) => (c.name || "").toLowerCase() === needle) ??
    all.find((c) => (c.model_id || "").toLowerCase() === needle) ??
    null
  );
}
