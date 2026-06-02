import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildUsageCapabilityRows,
  dailyRequestSeriesForPipeline,
  utcDateKeysForPeriod,
} from "./usage-capability-display";

describe("usage-capability-display", () => {
  it("utcDateKeysForPeriod returns inclusive UTC days", () => {
    const keys = utcDateKeysForPeriod(
      "2026-06-01T00:00:00.000Z",
      "2026-06-03T23:59:59.999Z",
    );
    assert.deepEqual(keys, ["2026-06-01", "2026-06-02", "2026-06-03"]);
  });

  it("dailyRequestSeriesForPipeline aligns OpenMeter day buckets", () => {
    const dayKeys = ["2026-06-01", "2026-06-02", "2026-06-03"];
    const series = dailyRequestSeriesForPipeline({
      pipeline: "live-video-to-video",
      modelId: "streamdiffusion",
      dayKeys,
      dailyByPipeline: [
        {
          pipeline: "live-video-to-video",
          modelId: "streamdiffusion",
          date: "2026-06-02",
          requestCount: 5,
        },
        {
          pipeline: "live-video-to-video",
          modelId: "streamdiffusion",
          date: "2026-06-03",
          requestCount: 14,
        },
      ],
    });
    assert.deepEqual(series, [0, 5, 14]);
    assert.equal(series.reduce((a, b) => a + b, 0), 19);
  });

  it("buildUsageCapabilityRows uses dailyRequests from API", () => {
    const rows = buildUsageCapabilityRows({
      period: { start: "2026-06-01T00:00:00.000Z", end: "2026-06-03T23:59:59.999Z" },
      current: [
        {
          pipeline: "live-video-to-video",
          modelId: "streamdiffusion",
          requestCount: 19,
          networkFeeUsdMicros: "113277",
          endUserBillableUsdMicros: "0",
          dailyRequests: [0, 5, 14],
        },
      ],
      prior: [],
    });
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0]!.data, [0, 5, 14]);
  });
});
