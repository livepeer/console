import { NextResponse } from "next/server";
import {
  DEFAULT_DISCOVERY_SERVICE_TYPE,
  fetchExploreModels,
  type DiscoveryServiceType,
} from "@/lib/discovery/client";

function parseServiceType(value: string | null): DiscoveryServiceType {
  if (value === "registry") return "registry";
  return DEFAULT_DISCOVERY_SERVICE_TYPE;
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const serviceType = parseServiceType(searchParams.get("serviceType"));

  try {
    const payload = await fetchExploreModels(serviceType);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Discovery Service request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
