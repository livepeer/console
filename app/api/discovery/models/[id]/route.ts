import { NextResponse } from "next/server";
import {
  DEFAULT_DISCOVERY_SERVICE_TYPE,
  fetchDiscoveryCapabilities,
  queryDiscoveryCapabilities,
  type DiscoveryServiceType,
} from "@/lib/discovery/client";
import { mapCapabilityToModel } from "@/lib/discovery/map-to-model";

function parseServiceType(value: string | null): DiscoveryServiceType {
  if (value === "registry") return "registry";
  return DEFAULT_DISCOVERY_SERVICE_TYPE;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const capability = decodeURIComponent(id);
  const { searchParams } = new URL(request.url);
  const serviceType = parseServiceType(searchParams.get("serviceType"));

  try {
    const capabilitiesResponse = await fetchDiscoveryCapabilities(serviceType);
    const entries = capabilitiesResponse.entries ?? [];
    const known =
      capabilitiesResponse.capabilities.includes(capability) ||
      entries.some((entry) => entry.capability === capability);

    if (!known) {
      return NextResponse.json({ error: "Capability not found" }, { status: 404 });
    }

    const entry = entries.find((item) => item.capability === capability);
    const queryResponse = await queryDiscoveryCapabilities([capability], serviceType);
    const model = mapCapabilityToModel(
      capability,
      entry,
      queryResponse.results[capability] ?? [],
    );

    return NextResponse.json({ model, serviceType });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Discovery Service request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
