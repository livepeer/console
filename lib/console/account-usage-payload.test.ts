import assert from "node:assert/strict";
import test from "node:test";
import {
  errorMessageFromBody,
  isAccountUsagePayload,
} from "./account-usage-payload";

function validPayload(): Record<string, unknown> {
  return {
    clientId: "app_dashboard",
    period: {
      start: "2026-07-08T00:00:00.000Z",
      end: "2026-08-07T00:00:00.000Z",
    },
    periodDayKeys: ["2026-08-06", "2026-08-07"],
    priorPeriod: {
      start: "2026-06-08T00:00:00.000Z",
      end: "2026-07-08T00:00:00.000Z",
    },
    balance: null,
    current: {
      requestCount: 3,
      networkFeeUsdMicros: "1200",
      endUserBillableUsdMicros: "2400",
      pipelineModels: [
        {
          pipeline: "text-to-image",
          modelId: "sd-3",
          requestCount: 3,
          networkFeeUsdMicros: "1200",
          endUserBillableUsdMicros: "2400",
          dailyRequests: [1, 2],
        },
      ],
      dailyByPipeline: [
        {
          pipeline: "text-to-image",
          modelId: "sd-3",
          date: "2026-08-07",
          requestCount: 2,
          networkFeeUsdMicros: "800",
        },
      ],
    },
    prior: { requestCount: 1, pipelineModels: [] },
  };
}

test("accepts a well-formed payload, with or without a balance", () => {
  assert.equal(isAccountUsagePayload(validPayload()), true);

  const withBalance = validPayload();
  withBalance.balance = {
    externalUserId: "95c33c7d-8951-4d9f-8c7f-3a589a4e4adc",
    balanceUsdMicros: "500000",
    consumedUsdMicros: "500000",
    lifetimeGrantedUsdMicros: "1000000",
    hasAccess: true,
  };
  assert.equal(isAccountUsagePayload(withBalance), true);
});

test("rejects bodies that aren't a payload object at all", () => {
  // The stub that crashed the sidebar in the browser.
  assert.equal(isAccountUsagePayload({}), false);
  assert.equal(isAccountUsagePayload(null), false);
  assert.equal(isAccountUsagePayload(undefined), false);
  assert.equal(isAccountUsagePayload([validPayload()]), false);
  assert.equal(isAccountUsagePayload("ok"), false);
});

test("rejects a payload missing only period, or with an unusable period", () => {
  const noPeriod = validPayload();
  delete noPeriod.period;
  assert.equal(isAccountUsagePayload(noPeriod), false);

  const noEnd = validPayload();
  noEnd.period = { start: "2026-07-08T00:00:00.000Z" };
  assert.equal(isAccountUsagePayload(noEnd), false);

  const nullEnd = validPayload();
  nullEnd.period = { start: "2026-07-08T00:00:00.000Z", end: null };
  assert.equal(isAccountUsagePayload(nullEnd), false);
});

test("rejects scopes whose BigInt/array reads would throw during render", () => {
  const noMicros = validPayload();
  noMicros.current = {
    ...(validPayload().current as object),
    endUserBillableUsdMicros: 2400,
  };
  assert.equal(isAccountUsagePayload(noMicros), false);

  const noRows = validPayload();
  noRows.current = {
    ...(validPayload().current as object),
    pipelineModels: null,
  };
  assert.equal(isAccountUsagePayload(noRows), false);

  const rowWithoutSeries = validPayload();
  rowWithoutSeries.current = {
    ...(validPayload().current as object),
    pipelineModels: [
      { pipeline: "text-to-image", modelId: "sd-3", requestCount: 3 },
    ],
  };
  assert.equal(isAccountUsagePayload(rowWithoutSeries), false);

  const noPrior = validPayload();
  delete noPrior.prior;
  assert.equal(isAccountUsagePayload(noPrior), false);

  const noDayKeys = validPayload();
  noDayKeys.periodDayKeys = undefined;
  assert.equal(isAccountUsagePayload(noDayKeys), false);
});

test("rejects a partial balance but allows an explicit null", () => {
  const partialBalance = validPayload();
  partialBalance.balance = { balanceUsdMicros: "500000", hasAccess: true };
  assert.equal(isAccountUsagePayload(partialBalance), false);

  const undefinedBalance = validPayload();
  undefinedBalance.balance = undefined;
  assert.equal(isAccountUsagePayload(undefinedBalance), false);
});

test("errorMessageFromBody only trusts a string error field", () => {
  assert.equal(
    errorMessageFromBody({ error: "upstream down" }),
    "upstream down"
  );
  assert.equal(errorMessageFromBody({ error: { code: 500 } }), null);
  assert.equal(errorMessageFromBody("upstream down"), null);
  assert.equal(errorMessageFromBody(null), null);
});
