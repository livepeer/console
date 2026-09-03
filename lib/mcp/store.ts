export type Asset = {
  id: string;
  url: string;
  capability: string;
  createdAt: string;
  /** Joins this asset to its ticket rows in PymtHouse metering. */
  gatewayRequestId: string;
};

const assets = new Map<string, Asset[]>();

export function rememberAsset(principalId: string, asset: Asset): void {
  const list = assets.get(principalId) ?? [];
  list.unshift(asset);
  assets.set(principalId, list.slice(0, 50));
}

export function listAssets(principalId: string, query?: string): Asset[] {
  const list = assets.get(principalId) ?? [];
  if (!query?.trim()) return list;
  const q = query.toLowerCase();
  return list.filter(
    (a) => a.capability.toLowerCase().includes(q) || a.url.toLowerCase().includes(q)
  );
}

export function forgetAssets(principalId: string, ids?: string[]): number {
  if (!ids?.length) {
    const n = (assets.get(principalId) ?? []).length;
    assets.delete(principalId);
    return n;
  }
  const set = new Set(ids);
  const list = (assets.get(principalId) ?? []).filter((a) => !set.has(a.id));
  const removed = (assets.get(principalId) ?? []).length - list.length;
  assets.set(principalId, list);
  return removed;
}
