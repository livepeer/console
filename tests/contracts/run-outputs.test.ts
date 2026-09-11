import { expect, it } from "vitest";
import { extractRunOutputs } from "@/lib/runs/outputs";

it("recognizes multiple output objects in returned arrays without treating prompts as assets", () => {
  expect(
    extractRunOutputs({
      data: [
        { images: [{ url: "https://media.example.com/a.png" }] },
        { video: { url: "https://media.example.com/b.mp4" } },
        { prompt: "https://media.example.com/not-an-output.png" },
      ],
    })
  ).toEqual([
    { url: "https://media.example.com/a.png", mediaKind: "image" },
    { url: "https://media.example.com/b.mp4", mediaKind: "video" },
  ]);
});

it("captures 3D model, texture and preview assets without confusing model identifiers or prompts", () => {
  const result = {
    model: { url: "https://provider.example/model.glb" },
    textures: [{ url: "https://provider.example/texture.png" }],
    preview_image: { url: "https://provider.example/preview.png" },
    prompt: "https://example.com/prompt",
  };
  expect(extractRunOutputs(result)).toEqual([
    { url: result.model.url, mediaKind: "model" },
    { url: result.preview_image.url, mediaKind: "image" },
    { url: result.textures[0]!.url, mediaKind: "image" },
  ]);
  expect(
    extractRunOutputs({
      model: "fal-ai/model",
      model_id: "https://example.com/not-output",
    })
  ).toEqual([]);
});
