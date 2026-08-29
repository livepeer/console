import type { App, PlaygroundConfig } from "@/lib/console/types";

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

export function buildLv2vPlaygroundConfig(_capability: string): PlaygroundConfig {
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

/** Live-runner demo apps with a simple request/response playground. */
export function isHelloWorldCapability(capability: string): boolean {
  const id = capability.toLowerCase();
  return id === "livepeer-example/hello-world" || id.endsWith("/hello-world");
}

export function buildHelloWorldPlaygroundConfig(): PlaygroundConfig {
  return {
    fields: [
      {
        name: "name",
        label: "Name",
        type: "text",
        required: true,
        defaultValue: "livepeer",
        placeholder: "Who should we greet?",
        description: "Passed as JSON { name } to POST /hello on the runner.",
      },
    ],
    outputType: "text",
    mockOutputText: "Hello, livepeer!",
    runnerPath: "hello",
  };
}

export function enrichDiscoveryModelForStreaming(model: App): App {
  if (isHelloWorldCapability(model.id)) {
    return {
      ...model,
      playgroundConfig: model.playgroundConfig ?? buildHelloWorldPlaygroundConfig(),
    };
  }

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
