import assert from "node:assert/strict";
import { test } from "node:test";

import {
  clipHistoryPage,
  HISTORY_LOOKBACK_MS,
  historyWindow,
} from "./history-window";

test("historyWindow spans seven days", () => {
  const now = new Date("2026-09-05T12:00:00.000Z");
  const window = historyWindow(now);
  assert.equal(window.to, now.toISOString());
  assert.equal(
    Date.parse(window.to) - Date.parse(window.from),
    HISTORY_LOOKBACK_MS
  );
});

test("clipHistoryPage stops paging once rows fall outside the window", () => {
  const now = new Date("2026-09-05T12:00:00.000Z");
  const clipped = clipHistoryPage(
    [
      { time: "2026-09-05T11:00:00.000Z" },
      { time: "2026-08-20T11:00:00.000Z" },
    ],
    "next",
    now
  );
  assert.equal(clipped.items.length, 1);
  assert.equal(clipped.nextCursor, null);
});
