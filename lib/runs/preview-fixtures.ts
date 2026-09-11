import "server-only";

import { createHash } from "node:crypto";
import type { AccountUsagePayload } from "@/lib/console/account-usage";
import { withPreviewRunFixtures } from "./store";
import type { RunOwner, RunPage } from "./types";

const PREVIEW_GRANT_USD_MICROS = 5_000_000;

export function previewFixturesEnabled(): boolean {
  return (
    process.env.VERCEL_ENV === "preview" &&
    process.env.CONSOLE_PREVIEW_FIXTURES === "1"
  );
}

/** Keep superseded button-era fixtures out of preview without deleting data. */
export function withoutLegacyPreviewFixtures(page: RunPage): RunPage {
  const legacy = page.items.filter(
    ({ id }) =>
      id.startsWith("run_preview_") && !id.startsWith("run_preview_v2_")
  );
  if (!legacy.length) return page;
  const counts = { ...page.counts };
  for (const run of legacy) {
    counts.total = Math.max(0, counts.total - 1);
    counts[run.status] = Math.max(0, counts[run.status] - 1);
  }
  return {
    ...page,
    counts,
    items: page.items.filter(({ id }) => !legacy.some((run) => run.id === id)),
  };
}

function fixtureIds(owner: RunOwner) {
  const suffix = createHash("sha256")
    .update(owner.principalId)
    .digest("hex")
    .slice(0, 12);
  return {
    suffix,
    runs: [
      `run_preview_v2_${suffix}_portrait`,
      `run_preview_v2_${suffix}_variation`,
      `run_preview_v2_${suffix}_caption`,
      `run_preview_v2_${suffix}_failed`,
    ],
  };
}

/**
 * Seed a realistic, owner-scoped History in Neon. IDs and receipt event keys
 * are deterministic, so normal page loads are idempotent rather than a hidden
 * mutation on every request.
 */
export async function ensurePreviewRunFixtures(
  owner: RunOwner,
  origin: string
): Promise<{
  runIds: string[];
  createdRunIds: string[];
  createdCount: number;
}> {
  return withPreviewRunFixtures(
    owner,
    async ({
      createRun,
      transitionRun,
      recordRunUsage,
      ownedRunsByIds,
      completedRunIds,
    }) => {
      const { suffix, runs: ids } = fixtureIds(owner);
      const existing = new Set(
        (await ownedRunsByIds(owner, ids)).map(({ id }) => id)
      );
      const complete = new Set(await completedRunIds());
      const created: string[] = [];
      const sourceAssetId = `asset_preview_v2_${suffix}_portrait`;
      const portraitUrl = `${origin}/images/console/explore/flux-schnell.webp`;

      if (!complete.has(ids[0]!)) {
        const run = await createRun(owner, {
          id: ids[0],
          gatewayRequestId: `job_preview_v2_${suffix}_portrait`,
          capability: "fal-ai/flux/schnell",
          modelId: "fal-ai/flux/schnell",
          endpoint: "/fal-ai/flux/schnell",
          submittedArguments: {
            capability: "fal-ai/flux/schnell",
            inputs: {
              prompt:
                "Editorial portrait in emerald light, soft grain, dark studio background",
              image_size: "landscape_4_3",
              num_images: 1,
              seed: 184729,
              enable_safety_checker: true,
            },
          },
        });
        await transitionRun(owner, run.id, {
          eventKey: "dispatch-returned",
          status: "succeeded",
          provider: "fal",
          providerRequestId: `provider_preview_v2_${suffix}_portrait`,
          result: {
            value: {
              images: [{ url: portraitUrl, width: 1024, height: 768 }],
              seed: 184729,
              inference_time_ms: 1284,
            },
          },
          assets: [
            {
              id: sourceAssetId,
              url: portraitUrl,
              mediaType: "image/webp",
            },
          ],
          metadata: { phase: "provider_complete", inferenceTimeMs: 1284 },
        });
        await recordRunUsage(owner, [
          {
            eventId: `receipt_preview_v2_${suffix}_portrait`,
            gatewayRequestId: `job_preview_v2_${suffix}_portrait`,
            metadata: {
              billingEventId: `receipt_preview_v2_${suffix}_portrait`,
              ticketGatewayRequestId: `job_preview_v2_${suffix}_portrait`,
              networkFeeUsdMicros: "9984.675492933755",
              feeWei: "3650000000000",
              ethUsdPrice: "2735.52753231",
              pixels: "786432",
              pipeline: "fal-ai/flux/schnell",
              modelId: "fal-ai/flux/schnell",
              timestamp: new Date().toISOString(),
            },
          },
        ]);
        if (!existing.has(run.id)) created.push(run.id);
      }

      if (!complete.has(ids[1]!)) {
        const inputUrl = `${origin}/api/assets/${sourceAssetId}?exp=9999999999&sig=preview-fixture`;
        const outputUrl = `${origin}/images/console/explore/img2img-sdxl.webp`;
        const run = await createRun(owner, {
          id: ids[1],
          gatewayRequestId: `job_preview_v2_${suffix}_variation`,
          capability: "fal-ai/fast-sdxl/image-to-image",
          modelId: "fal-ai/fast-sdxl/image-to-image",
          endpoint: "/fal-ai/fast-sdxl/image-to-image",
          submittedArguments: {
            capability: "fal-ai/fast-sdxl/image-to-image",
            inputs: {
              prompt: "Turn the portrait into a warm risograph print",
              image_url: inputUrl,
              strength: 0.72,
              guidance_scale: 7.5,
              num_inference_steps: 28,
            },
          },
        });
        await transitionRun(owner, run.id, {
          eventKey: "dispatch-returned",
          status: "succeeded",
          provider: "fal",
          providerRequestId: `provider_preview_v2_${suffix}_variation`,
          result: {
            value: {
              images: [{ url: outputUrl, width: 1024, height: 1024 }],
              inference_time_ms: 2418,
            },
          },
          assets: [
            {
              id: `asset_preview_v2_${suffix}_variation`,
              url: outputUrl,
              mediaType: "image/webp",
            },
          ],
          metadata: { phase: "provider_complete", inferenceTimeMs: 2418 },
        });
        await recordRunUsage(owner, [
          {
            eventId: `receipt_preview_v2_${suffix}_variation_1`,
            gatewayRequestId: `job_preview_v2_${suffix}_variation`,
            metadata: {
              billingEventId: `receipt_preview_v2_${suffix}_variation_1`,
              ticketGatewayRequestId: `job_preview_v2_${suffix}_variation`,
              pipeline: "fal-ai/fast-sdxl/image-to-image",
              modelId: "fal-ai/fast-sdxl/image-to-image",
              networkFeeUsdMicros: "1000.25",
              pixels: "524288",
              timestamp: new Date().toISOString(),
            },
          },
          {
            eventId: `receipt_preview_v2_${suffix}_variation_2`,
            gatewayRequestId: `job_preview_v2_${suffix}_variation`,
            metadata: {
              billingEventId: `receipt_preview_v2_${suffix}_variation_2`,
              ticketGatewayRequestId: `job_preview_v2_${suffix}_variation`,
              pipeline: "fal-ai/fast-sdxl/image-to-image",
              modelId: "fal-ai/fast-sdxl/image-to-image",
              networkFeeUsdMicros: "2000.75",
              pixels: "524288",
              timestamp: new Date().toISOString(),
            },
          },
        ]);
        if (!existing.has(run.id)) created.push(run.id);
      }

      if (!complete.has(ids[2]!)) {
        const run = await createRun(owner, {
          id: ids[2],
          gatewayRequestId: `job_preview_v2_${suffix}_caption`,
          capability: "meta-llama/llama-3.1-8b-instruct",
          modelId: "meta-llama/llama-3.1-8b-instruct",
          endpoint: "/v1/chat/completions",
          submittedArguments: {
            capability: "meta-llama/llama-3.1-8b-instruct",
            inputs: {
              prompt:
                "Write a one-line gallery caption for an emerald portrait.",
              max_tokens: 80,
              temperature: 0.6,
            },
          },
        });
        await transitionRun(owner, run.id, {
          eventKey: "dispatch-returned",
          status: "succeeded",
          provider: "livepeer",
          providerRequestId: `provider_preview_v2_${suffix}_caption`,
          result: {
            value: {
              text: "Emerald light turns a quiet portrait into a signal from elsewhere.",
              usage: { prompt_tokens: 18, completion_tokens: 14 },
              inference_time_ms: 642,
            },
          },
          metadata: { phase: "provider_complete", inferenceTimeMs: 642 },
        });
        await recordRunUsage(owner, [
          {
            eventId: `receipt_preview_v2_${suffix}_caption`,
            gatewayRequestId: `job_preview_v2_${suffix}_caption`,
            metadata: {
              billingEventId: `receipt_preview_v2_${suffix}_caption`,
              ticketGatewayRequestId: `job_preview_v2_${suffix}_caption`,
              pipeline: "text-generation",
              modelId: "meta-llama/llama-3.1-8b-instruct",
              networkFeeUsdMicros: "840.125",
              timestamp: new Date().toISOString(),
            },
          },
        ]);
        if (!existing.has(run.id)) created.push(run.id);
      }

      if (!complete.has(ids[3]!)) {
        const run = await createRun(owner, {
          id: ids[3],
          gatewayRequestId: `job_preview_v2_${suffix}_failed`,
          capability: "fal-ai/fast-svd",
          modelId: "fal-ai/fast-svd",
          endpoint: "/fal-ai/fast-svd",
          submittedArguments: {
            capability: "fal-ai/fast-svd",
            inputs: {
              prompt: "Slow camera orbit around the subject",
              duration_seconds: 6,
              fps: 24,
            },
          },
        });
        await transitionRun(owner, run.id, {
          eventKey: "dispatch-returned",
          status: "failed",
          provider: "fal",
          providerRequestId: `provider_preview_v2_${suffix}_failed`,
          errorCode: "provider_capacity",
          errorMessage: "No worker accepted the request before its deadline.",
          metadata: { phase: "provider_error", retryable: true },
        });
        if (!existing.has(run.id)) created.push(run.id);
      }

      return {
        runIds: ids,
        createdRunIds: created,
        createdCount: created.length,
      };
    }
  );
}

function utcDayKeys(days: number, now = new Date()): string[] {
  const keys: string[] = [];
  for (let offset = days - 1; offset >= 0; offset--) {
    const date = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - offset
      )
    );
    keys.push(date.toISOString().slice(0, 10));
  }
  return keys;
}

/** Synthetic preview allowance aligned with the receipts seeded above. */
export function previewAccountUsage(input: {
  externalUserId: string;
  periodDays: number;
  window: "rolling" | "mtd";
  includePrior: boolean;
}): AccountUsagePayload {
  const now = new Date();
  const monthDays = now.getUTCDate();
  const days = input.window === "mtd" ? monthDays : input.periodDays;
  const keys = utcDayKeys(days, now);
  const today = keys.at(-1)!;
  const consumed = "13825.800492933755";
  const balance = "4986174.199507066245";
  const rows = [
    {
      pipeline: "fal-ai/flux/schnell",
      modelId: "fal-ai/flux/schnell",
      requestCount: 1,
      networkFeeUsdMicros: "9984.675492933755",
      endUserBillableUsdMicros: "9984.675492933755",
      dailyRequests: keys.map((key) => (key === today ? 1 : 0)),
    },
    {
      pipeline: "fal-ai/fast-sdxl/image-to-image",
      modelId: "fal-ai/fast-sdxl/image-to-image",
      requestCount: 1,
      networkFeeUsdMicros: "3001",
      endUserBillableUsdMicros: "3001",
      dailyRequests: keys.map((key) => (key === today ? 1 : 0)),
    },
    {
      pipeline: "text-generation",
      modelId: "meta-llama/llama-3.1-8b-instruct",
      requestCount: 1,
      networkFeeUsdMicros: "840.125",
      endUserBillableUsdMicros: "840.125",
      dailyRequests: keys.map((key) => (key === today ? 1 : 0)),
    },
  ];
  const end = new Date(now);
  end.setUTCHours(23, 59, 59, 999);
  const start = new Date(`${keys[0]}T00:00:00.000Z`);
  const priorEnd = new Date(start.getTime() - 1);
  const priorStart = new Date(priorEnd);
  priorStart.setUTCDate(priorStart.getUTCDate() - (days - 1));
  priorStart.setUTCHours(0, 0, 0, 0);
  return {
    clientId: "app_preview_console",
    period: { start: start.toISOString(), end: end.toISOString() },
    periodDayKeys: keys,
    priorPeriod: {
      start: priorStart.toISOString(),
      end: priorEnd.toISOString(),
    },
    balance: {
      externalUserId: input.externalUserId,
      balanceUsdMicros: balance,
      consumedUsdMicros: consumed,
      lifetimeGrantedUsdMicros: String(PREVIEW_GRANT_USD_MICROS),
      hasAccess: true,
    },
    current: {
      requestCount: 3,
      networkFeeUsdMicros: consumed,
      endUserBillableUsdMicros: consumed,
      pipelineModels: rows,
      dailyByPipeline: rows.map((row) => ({
        pipeline: row.pipeline,
        modelId: row.modelId,
        date: today,
        requestCount: row.requestCount,
        networkFeeUsdMicros: row.networkFeeUsdMicros,
      })),
    },
    prior: input.includePrior
      ? {
          requestCount: 2,
          pipelineModels: rows.slice(0, 2).map((row) => ({
            ...row,
            requestCount: 1,
            dailyRequests: [],
          })),
        }
      : { requestCount: 0, pipelineModels: [] },
  };
}
