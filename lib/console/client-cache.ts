"use client";

/**
 * Module-level stale-while-revalidate cache for client fetch hooks.
 *
 * Console routes are client components, so navigating Home → Usage → Home
 * unmounts every hook on the way out and starts them from `idle` on the way
 * back. Without a cache that outlives the component, each return visit
 * repaints the skeleton and refetches data that was on screen seconds ago.
 *
 * A hook seeds its initial state from `peek()` (so a warm entry renders on
 * the first frame, with no `idle` beat), then calls `fetch()` to revalidate
 * behind the current view when the entry is stale or missing. Concurrent
 * callers for the same key share one request.
 */
export type ClientCacheEntry<T> = { data: T; at: number };

export function createClientCache<T>(ttlMs: number) {
  const entries = new Map<string, ClientCacheEntry<T>>();
  const inFlight = new Map<string, Promise<T>>();

  return {
    peek(key: string): ClientCacheEntry<T> | undefined {
      return entries.get(key);
    },
    isFresh(entry: ClientCacheEntry<T> | undefined): boolean {
      return !!entry && Date.now() - entry.at < ttlMs;
    },
    set(key: string, data: T): void {
      entries.set(key, { data, at: Date.now() });
    },
    delete(key: string): void {
      entries.delete(key);
    },
    /**
     * Run `fetcher` for `key`, deduplicating against any request already in
     * flight for the same key, and store the result on success.
     */
    fetch(key: string, fetcher: () => Promise<T>): Promise<T> {
      const existing = inFlight.get(key);
      if (existing) return existing;

      const request = fetcher()
        .then((data) => {
          entries.set(key, { data, at: Date.now() });
          return data;
        })
        .finally(() => {
          inFlight.delete(key);
        });

      inFlight.set(key, request);
      return request;
    },
  };
}
