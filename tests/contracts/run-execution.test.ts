import { describe, expect, it, vi } from "vitest";
import {
  executeDurableRun,
  type ExecutionDependencies,
} from "../../lib/runs/execute";
import type { RunDetail } from "../../lib/runs/types";
import type { McpPrincipal } from "../../lib/mcp/jwt";

const principal: McpPrincipal = {
  sub: "subject",
  externalUserId: "eu_test",
  publicClientId: "app",
  scope: "sign:job",
  token: "never-capture",
};
const owner = {
  principalId: "eu_test",
  userId: "user",
  externalAccountId: "account",
};
function fixture() {
  const run = { ...owner, id: "run_test" } as RunDetail;
  const deps: ExecutionDependencies = {
    store: {
      recordRunPaymentManifest: vi.fn().mockResolvedValue(undefined),
      resolveRunOwner: vi.fn().mockResolvedValue(owner),
      createRun: vi.fn().mockResolvedValue(run),
      transitionRun: vi.fn().mockResolvedValue(run),
    },
    checkSpend: vi.fn().mockResolvedValue(undefined),
    describe: vi.fn().mockResolvedValue({ mode: "single-shot" }),
    infer: vi.fn().mockResolvedValue({
      gatewayRequestId: "job_test",
      data: { text: "hello" },
      status: null,
      url: null,
      billableUnits: null,
    }),
  };
  return deps;
}

describe("durable MCP execution", () => {
  it("records complete submitted JSON before any preflight or inference", async () => {
    const deps = fixture();
    const args = {
      capability: "text",
      inputs: { nested: { seed: 42 }, authorization: "secret" },
      prompt: "hello",
    };
    const reply = await executeDurableRun(principal, args, deps);
    expect(reply.payload.run_id).toBe("run_test");
    expect(deps.store.createRun).toHaveBeenCalledWith(
      owner,
      expect.objectContaining({
        submittedArguments: {
          ...args,
          inputs: { nested: { seed: 42 }, authorization: "[REDACTED]" },
        },
      })
    );
    expect(
      vi.mocked(deps.store.createRun).mock.invocationCallOrder[0]
    ).toBeLessThan(vi.mocked(deps.checkSpend).mock.invocationCallOrder[0]);
    expect(deps.store.transitionRun).toHaveBeenCalledWith(
      owner,
      "run_test",
      expect.objectContaining({
        status: "succeeded",
        result: expect.objectContaining({ value: { text: "hello" } }),
      })
    );
  });
  it("does not dispatch or check spend when initial persistence fails", async () => {
    const deps = fixture();
    vi.mocked(deps.store.createRun).mockRejectedValue(new Error("db"));
    expect(
      (await executeDurableRun(principal, { capability: "test" }, deps)).payload
        .error
    ).toBe("run_store_unavailable");
    expect(deps.checkSpend).not.toHaveBeenCalled();
    expect(deps.infer).not.toHaveBeenCalled();
  });
  it("rejects oversized arguments before database and execution", async () => {
    const deps = fixture();
    expect(
      (
        await executeDurableRun(
          principal,
          { capability: "test", prompt: "x".repeat(1024 * 1024) },
          deps
        )
      ).payload.error
    ).toBe("arguments_capture_limit");
    expect(deps.store.createRun).not.toHaveBeenCalled();
    expect(deps.infer).not.toHaveBeenCalled();
  });
  it("records preflight refusal against the saved run", async () => {
    const deps = fixture();
    vi.mocked(deps.checkSpend).mockRejectedValue(new Error("insufficient"));
    await executeDurableRun(principal, { capability: "test" }, deps);
    expect(deps.infer).not.toHaveBeenCalled();
    expect(deps.store.transitionRun).toHaveBeenCalledWith(
      owner,
      "run_test",
      expect.objectContaining({
        status: "failed",
        eventKey: "preflight-rejected",
      })
    );
  });
  it("never repeats paid execution when terminal storage fails", async () => {
    const deps = fixture();
    vi.mocked(deps.store.transitionRun).mockImplementation(
      async (_owner, _id, transition) => {
        if (transition.eventKey === "dispatch-returned") throw new Error("db");
        return { id: "run_test" } as RunDetail;
      }
    );
    const response = await executeDurableRun(
      principal,
      { capability: "test" },
      deps
    );
    expect(response.payload.persist_error).toBe("run_store_unavailable");
    expect(response.payload.data).toEqual({ text: "hello" });
    expect(response.payload.billable_units).toBeNull();
    expect(deps.infer).toHaveBeenCalledTimes(1);
  });
  it("forwards billable_units from the gateway result", async () => {
    const deps = fixture();
    vi.mocked(deps.infer).mockResolvedValue({
      gatewayRequestId: "job_test",
      data: { text: "hello" },
      status: null,
      url: null,
      billableUnits: 2.5,
    } as never);
    const reply = await executeDurableRun(
      principal,
      { capability: "test" },
      deps
    );
    expect(reply.payload.billable_units).toBe(2.5);
  });
  it("returns asset ids and first-party URLs without leaking provider media URLs", async () => {
    const deps = fixture();
    const providerUrl = "https://v3b.fal.media/files/output.mp4";
    vi.mocked(deps.infer).mockResolvedValue({
      gatewayRequestId: "job_test",
      data: { video_urls: [providerUrl] },
      status: "COMPLETED",
      videoUrl: providerUrl,
    } as never);
    vi.mocked(deps.store.transitionRun).mockImplementation(
      async (_owner, _id, transition) =>
        ({
          ...owner,
          id: "run_test",
          assets:
            transition.eventKey === "dispatch-returned"
              ? [
                  {
                    id: "asset_123",
                    url: providerUrl,
                    mediaType: "video",
                    providerRequestId: null,
                    availableUntil: null,
                    expiresAt: null,
                    unavailableAt: null,
                    hiddenAt: null,
                    createdAt: "2026-09-09T12:00:00.000Z",
                  },
                ]
              : [],
        }) as RunDetail
    );

    const response = await executeDurableRun(
      principal,
      { capability: "video" },
      deps
    );
    expect(response.payload.url).toMatch(
      /^http:\/\/localhost:3000\/api\/assets\/asset_123\?exp=\d+&sig=[A-Za-z0-9_-]+$/
    );
    expect(response.payload.assets).toEqual([
      {
        id: "asset_123",
        url: expect.stringMatching(
          /^http:\/\/localhost:3000\/api\/assets\/asset_123\?exp=\d+&sig=[A-Za-z0-9_-]+$/
        ),
        media_type: "video",
      },
    ]);
    expect(JSON.stringify(response.payload)).not.toContain("fal.media");
    expect(response.payload).not.toHaveProperty("status_url");
    expect(response.payload).not.toHaveProperty("response_url");
  });
  it("persists interrupted execution as unknown, not failed", async () => {
    const deps = fixture();
    vi.mocked(deps.infer).mockRejectedValue(new Error("timeout"));
    await executeDurableRun(principal, { capability: "test" }, deps);
    expect(deps.store.transitionRun).toHaveBeenCalledWith(
      owner,
      "run_test",
      expect.objectContaining({
        status: "unknown",
        errorCode: "execution_outcome_unknown",
      })
    );
  });
  it("retains public queue receipt for recovery without declaring success", async () => {
    const deps = fixture();
    vi.mocked(deps.infer).mockResolvedValue({
      data: { request_id: "id" },
      status: "IN_QUEUE",
      statusUrl: "https://queue.fal.run/fal-ai/model/requests/id/status",
      responseUrl: "https://queue.fal.run/fal-ai/model/requests/id",
      gatewayRequestId: "job_test",
    } as never);
    await executeDurableRun(principal, { capability: "test" }, deps);
    expect(deps.store.transitionRun).toHaveBeenCalledWith(
      owner,
      "run_test",
      expect.objectContaining({
        status: "running",
        queue: expect.objectContaining({
          statusUrl: "https://queue.fal.run/fal-ai/model/requests/id/status",
        }),
      })
    );
  });
  it.each(["IN_QUEUE", "COMPLETED"])(
    "keeps unsupported final queue handles unknown even when the provider says %s",
    async (status) => {
      const deps = fixture();
      vi.mocked(deps.infer).mockImplementation(async (request) => {
        await request.onProgress({
          status: "IN_PROGRESS",
          elapsedMs: 100,
          requestId: "old-request",
          statusUrl:
            "https://queue.fal.run/fal-ai/model/requests/old-request/status",
        });
        return {
          data: { request_id: "new-request" },
          status,
          statusUrl:
            "https://private-provider.example.invalid/queue/new-request",
          responseUrl:
            "https://private-provider.example.invalid/results/new-request",
          gatewayRequestId: request.gatewayRequestId,
        } as never;
      });
      await executeDurableRun(principal, { capability: "test" }, deps);
      const final = vi
        .mocked(deps.store.transitionRun)
        .mock.calls.find(
          ([, , change]) => change.eventKey === "dispatch-returned"
        )?.[2];
      expect(final).toMatchObject({
        status: "unknown",
        errorCode: "unsupported_queue_handle",
        stopReconciliation: "unsupported_final_queue_handle",
      });
      expect(final).not.toHaveProperty("queue");
      expect(deps.infer).toHaveBeenCalledTimes(1);
    }
  );
});

it("retries accepted payment persist on a transient store failure", async () => {
  const deps = fixture();
  let acceptedAttempts = 0;
  vi.mocked(deps.store.recordRunPaymentManifest).mockImplementation(
    async (_owner, _id, payment) => {
      if (payment.phase === "accepted" && ++acceptedAttempts === 1)
        throw new Error("db unavailable");
    }
  );
  vi.mocked(deps.infer).mockImplementation(async ({ onPayment }) => {
    await onPayment({ manifestId: "manifest-1", phase: "prepared" });
    await onPayment({ manifestId: "manifest-1", phase: "accepted" });
    return {
      gatewayRequestId: "job_test",
      data: { text: "ok" },
      status: "succeeded",
      url: null,
      billableUnits: null,
    } as never;
  });
  const reply = await executeDurableRun(principal, { capability: "test" }, deps);
  expect(reply.isError).toBe(false);
  expect(acceptedAttempts).toBe(2);
  expect(deps.store.recordRunPaymentManifest).toHaveBeenCalledTimes(3);
});

it("aborts after payment persist retries are exhausted", async () => {
  const deps = fixture();
  vi.mocked(deps.store.recordRunPaymentManifest).mockRejectedValue(
    new Error("db unavailable")
  );
  vi.mocked(deps.infer).mockImplementation(async ({ onPayment }) => {
    await onPayment({ manifestId: "manifest-1", phase: "accepted" });
    return {
      gatewayRequestId: "job_test",
      data: { text: "ok" },
      status: "succeeded",
      url: null,
      billableUnits: null,
    } as never;
  });
  const reply = await executeDurableRun(principal, { capability: "test" }, deps);
  expect(reply.isError).toBe(true);
  expect(deps.store.recordRunPaymentManifest).toHaveBeenCalledTimes(3);
  expect(deps.store.transitionRun).toHaveBeenCalledWith(
    owner,
    "run_test",
    expect.objectContaining({
      status: "unknown",
      errorCode: "execution_outcome_unknown",
    })
  );
});

it("records every payment phase against the run even when inference fails afterward", async () => {
  const deps = fixture();
  vi.mocked(deps.infer).mockImplementation(async ({ onPayment }) => {
    for (const manifestId of ["failed-attempt", "successful-attempt"])
      for (const phase of ["prepared", "accepted"] as const)
        await onPayment({ manifestId, phase });
    throw new Error("provider unavailable");
  });
  await executeDurableRun(principal, { capability: "test" }, deps);
  expect(deps.store.recordRunPaymentManifest).toHaveBeenCalledTimes(4);
  expect(deps.store.recordRunPaymentManifest).toHaveBeenLastCalledWith(
    owner,
    "run_test",
    { manifestId: "successful-attempt", phase: "accepted" }
  );
});

it("persists explicit expiry and sanitizes all returned media with partial capture", async () => {
  const deps = fixture();
  const expiresAt = "2026-10-01T00:00:00.000Z";
  vi.mocked(deps.infer).mockResolvedValue({
    gatewayRequestId: "job_test",
    status: "succeeded",
    url: null,
    billableUnits: null,
    data: {
      images: [
        { url: "https://provider.example/owned", expiresAt },
        { url: "https://provider.example/missing" },
        { url: "https://provider.example/signed?token=private" },
      ],
      output_url: "https://provider.example/download?token=private",
      outputUrl: "https://provider.example/download?token=private",
      outputURL: "https://provider.example/download?token=private",
      preview_url: "https://provider.example/preview?token=private",
      previewUrl: "https://provider.example/preview?token=private",
      status_url: "https://queue.fal.run/fal-ai/flux/requests/id/status",
      statusUrl: "https://queue.fal.run/fal-ai/flux/requests/id/status",
      responseURI: "https://queue.fal.run/fal-ai/flux/requests/id",
      asset2Url: "https://provider.example/signed?token=private",
    },
  } as unknown as Awaited<ReturnType<ExecutionDependencies["infer"]>>);
  vi.mocked(deps.store.transitionRun).mockResolvedValue({
    ...owner,
    id: "run_test",
    assets: [
      { id: "owned", url: "https://provider.example/owned", role: "output" },
    ],
  } as RunDetail);
  const result = await executeDurableRun(
    principal,
    { capability: "image" },
    deps
  );
  expect(deps.store.transitionRun).toHaveBeenCalledWith(
    owner,
    "run_test",
    expect.objectContaining({
      assets: expect.arrayContaining([
        expect.objectContaining({
          url: "https://provider.example/owned",
          expiresAt,
        }),
      ]),
    })
  );
  expect(JSON.stringify(result.payload)).not.toMatch(
    /provider.example|private|REDACTED|queue\.fal\.run/
  );
  expect(JSON.stringify(result.payload)).toContain("/api/assets/owned");
});
