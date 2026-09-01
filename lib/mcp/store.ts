export type Asset = {
  id: string;
  url: string;
  capability: string;
  createdAt: string;
};

export type Job = {
  id: string;
  status: "running" | "succeeded" | "failed" | "cancelled";
  capability: string;
  url?: string;
  error?: string;
  createdAt: string;
};

const assets = new Map<string, Asset[]>();
const jobs = new Map<string, Job>();

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

/** Jobs are keyed per principal so a leaked job_id is not a read/cancel handle. */
function jobKey(principalId: string, id: string): string {
  return `${principalId}\u0000${id}`;
}

export function putJob(principalId: string, job: Job): void {
  jobs.set(jobKey(principalId, job.id), job);
}

export function getJob(principalId: string, id: string): Job | undefined {
  return jobs.get(jobKey(principalId, id));
}

export function cancelJob(principalId: string, id: string): Job | undefined {
  const job = getJob(principalId, id);
  if (!job) return undefined;
  if (job.status === "running") {
    job.status = "cancelled";
  }
  return job;
}
