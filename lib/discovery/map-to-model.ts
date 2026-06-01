import type { Model, ModelCategory, ModelStatus, PricingUnit } from "@/lib/dashboard/types";
import { enrichDiscoveryModelForStreaming } from "@/lib/dashboard/streaming-playground";
import type { DiscoveryCapabilityEntry, DiscoveryDatasetRow } from "./types";

function inferCategory(capability: string): ModelCategory {
  const c = capability.toLowerCase();

  if (c.startsWith("video:transcode") || c === "video:live.rtmp") {
    return "Live Transcoding";
  }
  if (
    c.includes("streamdiffusion") ||
    c.includes("stable-video") ||
    c.includes("img2vid") ||
    c.startsWith("video:")
  ) {
    return "Video Generation";
  }
  if (
    c.includes("whisper") ||
    c.startsWith("openai:audio") ||
    c.includes("tts") ||
    c.includes("parler")
  ) {
    return "Speech";
  }
  if (
    c.startsWith("openai:images") ||
    c.includes("flux") ||
    c.includes("sdxl") ||
    c.includes("diffusion") ||
    c.includes("pix2pix") ||
    c.includes("upscaler") ||
    c.includes("realvis") ||
    c.includes("instruct-pix")
  ) {
    return "Image Generation";
  }
  if (c.includes("sam2") || c.includes("vision")) {
    return "Video Understanding";
  }
  return "Language";
}

function inferPricingUnit(workUnit: string | undefined, capability: string): PricingUnit {
  if (workUnit === "tokens") return "M Tokens";
  if (workUnit?.includes("second")) return "Second";
  if (capability.startsWith("video:")) return "Minute";
  return "Request";
}

function humanizeCapabilityName(capability: string): string {
  const segment = capability.includes(":")
    ? capability.split(":").slice(-1)[0]!
    : capability;
  return segment
    .split(/[-_./]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function aggregateRows(rows: DiscoveryDatasetRow[]): {
  orchestrators: number;
  status: ModelStatus;
  latency: number;
  price: number;
  realtime: boolean;
} {
  const orchUris = new Set(rows.map((row) => row.orchUri).filter(Boolean));
  const warm = rows.some((row) => row.avail > 0 || row.totalCap > 0);
  const latencies = rows
    .map((row) => row.avgLatMs ?? row.bestLatMs)
    .filter((value): value is number => value != null && value > 0);
  const prices = rows.map((row) => row.pricePerUnit).filter((value) => value > 0);

  return {
    orchestrators: orchUris.size,
    status: warm ? "hot" : "cold",
    latency:
      latencies.length > 0
        ? latencies.reduce((sum, value) => sum + value, 0) / latencies.length
        : 0,
    price: prices.length > 0 ? Math.min(...prices) : 0,
    realtime: rows.some((row) => row.interactionMode?.includes("stream") ?? false),
  };
}

export function mapCapabilityToModel(
  capability: string,
  entry: DiscoveryCapabilityEntry | undefined,
  rows: DiscoveryDatasetRow[],
): Model {
  const stats = aggregateRows(rows);
  const sample = rows[0];
  const provider =
    entry?.offeringIds?.[0] ??
    (entry?.serviceType === "registry" ? "Registry" : "Livepeer network");

  return enrichDiscoveryModelForStreaming({
    id: capability,
    name: humanizeCapabilityName(capability),
    provider,
    category: inferCategory(capability),
    description: `${humanizeCapabilityName(capability)} on the Livepeer open GPU network (${stats.orchestrators} orchestrator${stats.orchestrators === 1 ? "" : "s"}).`,
    status: stats.status,
    pricing: {
      amount: stats.price > 0 ? stats.price : 0.001,
      unit: inferPricingUnit(sample?.workUnit, capability),
    },
    latency: stats.latency,
    orchestrators: stats.orchestrators,
    runs7d: Math.max(stats.orchestrators * 8, stats.orchestrators > 0 ? 1 : 0),
    uptime: stats.status === "hot" ? 99.2 : 0,
    realtime: stats.realtime,
    featured: stats.realtime && stats.status === "hot",
    tags: entry?.serviceType ? [entry.serviceType] : undefined,
  });
}
