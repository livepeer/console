import type { Model, PlaygroundConfig } from "@/lib/dashboard/types";

/** Discovery capability ids that get the LV2V webcam / gateway playground. */
export function isLv2vPlaygroundCapability(capability: string): boolean {
  const id = capability.toLowerCase();
  return (
    id.includes("streamdiffusion") ||
    id === "live-video-to-video" ||
    id.startsWith("live-video")
  );
}

/**
 * Resolve the orchestrator pipeline model name for a capability.
 * Discovery page id may differ from the orchestrator pipeline model name.
 */
export function resolveGatewayModelId(capability: string): string {
  const id = capability.trim();
  const lower = id.toLowerCase();
  if (lower === "streamdiffusion") {
    return "streamdiffusion";
  }
  if (lower === "live-video-to-video") {
    return "streamdiffusion-sdxl";
  }
  return id;
}

export function buildLv2vPlaygroundConfig(capability: string): PlaygroundConfig {
  return {
    fields: [
      {
        name: "prompt",
        label: "Prompt",
        type: "textarea",
        placeholder: "Describe the look or style for the stream…",
        description: "Optional pipeline prompt (passed when starting the LV2V job).",
      },
      {
        name: "style",
        label: "Style preset",
        type: "select",
        options: ["none", "cinematic", "anime", "watercolor", "neon", "sketch"],
        defaultValue: "none",
        description: "Local preview label only until full pipeline params are wired.",
      },
      {
        name: "strength",
        label: "Strength",
        type: "range",
        min: 0,
        max: 1,
        step: 0.05,
        defaultValue: 0.6,
      },
    ],
    outputType: "video",
    playgroundVariant: "webcam",
    mockOutputUrl: "https://picsum.photos/seed/streamdiffusion/640/360",
  };
}

export function enrichDiscoveryModelForStreaming(model: Model): Model {
  if (!isLv2vPlaygroundCapability(model.id)) {
    return model;
  }

  return {
    ...model,
    realtime: true,
    category:
      model.category === "Language" ? "Video Generation" : model.category,
    gatewayModelId: resolveGatewayModelId(model.id),
    playgroundConfig: model.playgroundConfig ?? buildLv2vPlaygroundConfig(model.id),
  };
}
