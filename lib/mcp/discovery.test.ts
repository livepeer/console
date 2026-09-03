import assert from "node:assert/strict";
import { test } from "node:test";

import {
  catalogFromDiscoverOrchestrators,
  enrichCapabilityDetail,
  findCapability
} from "./discovery";
import {
  discoverOrchestratorsUrl,
  resolveDiscoveryUrl
} from "./signer-exchange";

const SIGNER_SHAPED = [
  {
    address: "https://ai.stronk.rocks:9994",
    score: 1,
    capabilities: ["live-video-to-video/streamdiffusion-sdxl"]
  },
  {
    address: "https://ai.ad-astra.live:9966",
    score: 1,
    capabilities: ["live-video-to-video/streamdiffusion"]
  },
  {
    address: "http://154.61.61.108:8787/",
    score: 1,
    capabilities: [
      "image-generation/black-forest-labs/FLUX.1-dev",
      "livepeer-example/flux-klein",
      "livepeer-example/hello-world",
      "livepeer-example/realtime-transcription",
      "transcode/ffmpeg",
      "transcoding-with-captions/whisper",
      "vllm/qwen3-coder-30b"
    ],
    runners: [
      {
        app: "image-generation/black-forest-labs/FLUX.1-dev",
        mode: "single-shot",
        capacity_available: 2,
        price_info: { price: 1, currency: "wei", unit: "seconds" }
      },
      {
        app: "image-generation/black-forest-labs/FLUX.1-dev",
        mode: "persistent",
        capacity_available: 1,
        price_info: { price: 2, currency: "wei", unit: "seconds" }
      },
      {
        app: "vllm/qwen3-coder-30b",
        mode: "single_shot",
        capacity_available: 4,
        price_info: { price: 3, currency: "wei", unit: "seconds" }
      },
      {
        app: "transcode/ffmpeg",
        mode: "persistent",
        capacity_available: 18,
        price_info: { price: 4, currency: "wei", unit: "seconds" }
      },
      {
        app: "livepeer-example/hello-world",
        mode: "persistent",
        capacity_available: 1
      },
      {
        app: "livepeer-example/flux-klein",
        mode: "persistent",
        capacity_available: 1
      },
      {
        app: "livepeer-example/realtime-transcription",
        mode: "persistent",
        capacity_available: 1
      },
      {
        app: "transcoding-with-captions/whisper",
        mode: "persistent",
        capacity_available: 1
      }
    ]
  },
  {
    address: "https://livepeerservice.world:8934",
    score: 1,
    capabilities: ["livepeer-sample/vllm-realtime"],
    runners: [
      {
        app: "livepeer-sample/vllm-realtime",
        mode: "persistent",
        capacity_available: 1,
        price_info: { price: 5, currency: "wei", unit: "seconds" }
      }
    ]
  }
];

test("catalogFromDiscoverOrchestrators keeps runner apps only", () => {
  const rows = catalogFromDiscoverOrchestrators(SIGNER_SHAPED);
  const names = rows.map((r) => r.name);

  assert.deepEqual(names, [
    "image-generation/black-forest-labs/FLUX.1-dev",
    "livepeer-example/flux-klein",
    "livepeer-example/hello-world",
    "livepeer-example/realtime-transcription",
    "livepeer-sample/vllm-realtime",
    "transcode/ffmpeg",
    "transcoding-with-captions/whisper",
    "vllm/qwen3-coder-30b"
  ]);

  for (const verb of ["chat", "t2v", "sam3"]) {
    assert.equal(names.includes(verb), false);
  }
  for (const stream of [
    "live-video-to-video/streamdiffusion",
    "live-video-to-video/streamdiffusion-sdxl",
    "streamdiffusion"
  ]) {
    assert.equal(names.includes(stream), false);
  }
});

test("mixed modes prefer single-shot and sum runners", () => {
  const flux = findCapability(
    catalogFromDiscoverOrchestrators(SIGNER_SHAPED),
    "image-generation/black-forest-labs/FLUX.1-dev"
  );
  assert.ok(flux);
  assert.equal(flux.mode, "single-shot");
  assert.equal(flux.runners, 2);
  assert.equal(flux.capacity_available, 3);
});

test("describe hits listed apps and misses Railway verbs", () => {
  const rows = catalogFromDiscoverOrchestrators(SIGNER_SHAPED);
  assert.equal(findCapability(rows, "vllm/qwen3-coder-30b")?.mode, "single-shot");
  assert.equal(findCapability(rows, "transcode/ffmpeg")?.mode, "persistent");
  assert.equal(findCapability(rows, "chat"), null);
});

test("enrichCapabilityDetail adds fal catalog metadata", () => {
  const row = findCapability(
    catalogFromDiscoverOrchestrators([
      {
        address: "https://orch:8936",
        runners: [
          {
            app: "livepeer-example/fal-flux-schnell",
            mode: "single-shot",
            capacity_available: 4,
            price_info: { price: 0.0001, currency: "usd", unit: "fixed" }
          }
        ]
      }
    ]),
    "livepeer-example/fal-flux-schnell"
  );
  assert.ok(row);
  const detail = enrichCapabilityDetail(row);
  assert.equal(detail.catalog?.endpoint_id, "fal-ai/flux/schnell");
  assert.match(detail.inputs_hint ?? "", /prompt/);
});

test("resolveDiscoveryUrl prefers session.discovery_url over signer fallback", () => {
  assert.equal(
    discoverOrchestratorsUrl("https://signer.pymthouse.com/"),
    "https://signer.pymthouse.com/discover-orchestrators"
  );
  assert.equal(
    resolveDiscoveryUrl({
      signer_url: "https://signer.pymthouse.com",
      discovery_url: "https://signer.pymthouse.com/discover-orchestrators/"
    }),
    "https://signer.pymthouse.com/discover-orchestrators"
  );
  assert.equal(
    resolveDiscoveryUrl({ signer_url: "https://signer.pymthouse.com" }),
    "https://signer.pymthouse.com/discover-orchestrators"
  );
});
