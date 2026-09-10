import { createHash } from "node:crypto";
import { requireRunOwner, runError, RUN_HEADERS } from "@/lib/runs/http";
import {
  createRun,
  ownedRunsByIds,
  recordRunUsage,
  transitionRun,
} from "@/lib/runs/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fixtureEnabled(): boolean {
  return (
    process.env.VERCEL_ENV === "preview" &&
    process.env.CONSOLE_PREVIEW_FIXTURES === "1"
  );
}

export async function POST(request: Request) {
  try {
    if (!fixtureEnabled()) return new Response("Not found", { status: 404 });
    const owner = await requireRunOwner();
    const suffix = createHash("sha256")
      .update(owner.principalId)
      .digest("hex")
      .slice(0, 12);
    const ids = [
      `run_preview_${suffix}_single`,
      `run_preview_${suffix}_aggregate`,
      `run_preview_${suffix}_unmatched`,
    ];
    const existing = new Set(
      (await ownedRunsByIds(owner, ids)).map(({ id }) => id)
    );
    const origin = new URL(request.url).origin;
    const firstAssetId = `asset_preview_${suffix}_source`;
    const firstAssetSource = `${origin}/images/console/explore/flux-schnell.webp`;
    const created: string[] = [];

    if (!existing.has(ids[0]!)) {
      const run = await createRun(owner, {
        id: ids[0],
        gatewayRequestId: `job_preview_${suffix}_single`,
        capability: "fal-ai/flux/schnell",
        submittedArguments: {
          capability: "fal-ai/flux/schnell",
          inputs: { prompt: "Preview fixture: geometric green light study" },
        },
      });
      await transitionRun(owner, run.id, {
        eventKey: "dispatch-returned",
        status: "succeeded",
        provider: "fal",
        providerRequestId: `provider_preview_${suffix}_single`,
        result: { value: { images: [{ url: firstAssetSource }] } },
        assets: [
          {
            id: firstAssetId,
            url: firstAssetSource,
            mediaType: "image/webp",
          },
        ],
      });
      await recordRunUsage(owner, [
        {
          eventId: `receipt_preview_${suffix}_single`,
          gatewayRequestId: `job_preview_${suffix}_single`,
          metadata: {
            networkFeeUsdMicros: "9984.675492933755",
            pipeline: "fal-ai/flux/schnell",
            modelId: "fal-ai/flux/schnell",
            timestamp: new Date().toISOString(),
          },
        },
      ]);
      created.push(run.id);
    }

    if (!existing.has(ids[1]!)) {
      const reusedUrl = `${origin}/api/assets/${firstAssetId}?exp=9999999999&sig=preview-fixture`;
      const output = `${origin}/images/console/explore/img2img-sdxl.webp`;
      const run = await createRun(owner, {
        id: ids[1],
        gatewayRequestId: `job_preview_${suffix}_aggregate`,
        capability: "fal-ai/fast-sdxl/image-to-image",
        submittedArguments: {
          capability: "fal-ai/fast-sdxl/image-to-image",
          inputs: {
            prompt: "Preview fixture: reuse the prior generated image",
            image_url: reusedUrl,
          },
        },
      });
      await transitionRun(owner, run.id, {
        eventKey: "dispatch-returned",
        status: "succeeded",
        provider: "fal",
        providerRequestId: `provider_preview_${suffix}_aggregate`,
        result: { value: { images: [{ url: output }] } },
        assets: [
          {
            id: `asset_preview_${suffix}_aggregate`,
            url: output,
            mediaType: "image/webp",
          },
        ],
      });
      await recordRunUsage(owner, [
        {
          eventId: `receipt_preview_${suffix}_aggregate_1`,
          gatewayRequestId: `job_preview_${suffix}_aggregate`,
          metadata: {
            networkFeeUsdMicros: "1000.25",
            timestamp: new Date().toISOString(),
          },
        },
        {
          eventId: `receipt_preview_${suffix}_aggregate_2`,
          gatewayRequestId: `job_preview_${suffix}_aggregate`,
          metadata: {
            networkFeeUsdMicros: "2000.75",
            timestamp: new Date().toISOString(),
          },
        },
      ]);
      created.push(run.id);
    }

    if (!existing.has(ids[2]!)) {
      const run = await createRun(owner, {
        id: ids[2],
        gatewayRequestId: `job_preview_${suffix}_unmatched`,
        capability: "fal-ai/flux/dev",
        submittedArguments: {
          capability: "fal-ai/flux/dev",
          inputs: { prompt: "Preview fixture: no matching billing receipt" },
        },
      });
      await transitionRun(owner, run.id, {
        eventKey: "dispatch-returned",
        status: "failed",
        provider: "fal",
        errorCode: "preview_fixture_failure",
        errorMessage: "Synthetic unmatched receipt state for preview review.",
      });
      created.push(run.id);
    }

    return Response.json(
      { runIds: ids, createdRunIds: created, createdCount: created.length },
      { headers: RUN_HEADERS }
    );
  } catch (error) {
    return runError(error);
  }
}
