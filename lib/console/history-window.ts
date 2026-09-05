/** Console history is a rolling 7-day window, paged in chunks — not a row cap. */
export const HISTORY_LOOKBACK_DAYS = 7;
export const HISTORY_LOOKBACK_MS = HISTORY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;

export function historyWindow(now = new Date()): { from: string; to: string } {
  return {
    from: new Date(now.getTime() - HISTORY_LOOKBACK_MS).toISOString(),
    to: now.toISOString(),
  };
}

export function isWithinHistoryWindow(
  iso: string,
  now = new Date()
): boolean {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return false;
  return (
    time >= now.getTime() - HISTORY_LOOKBACK_MS &&
    time <= now.getTime() + 60_000
  );
}

/** Drop rows older than 7 days and stop paging once a page walks past the window. */
export function clipHistoryPage<T extends { time: string }>(
  items: T[],
  nextCursor: string | null,
  now = new Date()
): { items: T[]; nextCursor: string | null } {
  const kept = items.filter((item) => isWithinHistoryWindow(item.time, now));
  return {
    items: kept,
    nextCursor: kept.length < items.length ? null : nextCursor,
  };
}
