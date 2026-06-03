import { formatCompact } from "./org-fleet";

/**
 * The CONSUME (outbound) ledger — the mirror of the "Your apps" SERVE ledger.
 *
 * An organization doesn't only deploy apps; it also *calls* apps across the
 * network — its own, and (mostly) apps it didn't deploy. That outbound demand
 * is what drives spend. This module answers the operator's question: "how much
 * of my usage is on apps I didn't build?"
 *
 * Mock note: in production this is aggregated from metered outbound requests.
 */

export interface ConsumedApp {
  /** App id when it's one of ours; otherwise a network slug for linking. */
  id: string;
  name: string;
  /** Provider/owner label, or "Your organization" for apps you deployed. */
  owner: string;
  /** Did THIS organization deploy it? false = an app you didn't build. */
  owned: boolean;
  calls7d: number;
  /** Month-to-date spend in dollars. */
  spendNum: number;
}

// What this organization calls. Mostly third-party network apps (you didn't
// deploy them); a little is the org exercising its own apps.
const CONSUMED_APPS_RAW: ConsumedApp[] = [
  { id: "daydream-video", name: "Daydream Video", owner: "daydream", owned: false, calls7d: 2_400, spendNum: 1.6 },
  { id: "flux-schnell", name: "FLUX Schnell", owner: "black-forest-labs", owned: false, calls7d: 1_900, spendNum: 0.95 },
  { id: "frameworks-transcoding", name: "Frameworks Transcoding", owner: "frameworks", owned: false, calls7d: 1_500, spendNum: 0.8 },
  { id: "qwen3-32b", name: "Qwen3 32B", owner: "qwen", owned: false, calls7d: 900, spendNum: 0.55 },
  { id: "whisper-v3", name: "Whisper V3", owner: "openai", owned: false, calls7d: 600, spendNum: 0.45 },
  { id: "sdxl-turbo", name: "SDXL Turbo", owner: "stability", owned: false, calls7d: 700, spendNum: 0.4 },
  { id: "llama-3-70b", name: "Llama 3 70B", owner: "meta", owned: false, calls7d: 400, spendNum: 0.25 },
  { id: "app-sentiment", name: "Sentiment", owner: "Your organization", owned: true, calls7d: 400, spendNum: 0.4 },
  { id: "app-image-upscale", name: "Image Upscale", owner: "Your organization", owned: true, calls7d: 100, spendNum: 0.3 },
];

export interface OrgConsumption {
  /** Apps you call, sorted by spend desc. The `owned` flag on each row tells
   *  your own apps apart from apps you didn't deploy. */
  apps: ConsumedApp[];
  totalCalls7d: number;
  totalSpendDisplay: string;
}

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function getOrgConsumption(): OrgConsumption {
  const apps = [...CONSUMED_APPS_RAW].sort((a, b) => b.spendNum - a.spendNum);
  const totalSpendNum = apps.reduce((s, a) => s + a.spendNum, 0);
  const totalCalls7d = apps.reduce((s, a) => s + a.calls7d, 0);

  return {
    apps,
    totalCalls7d,
    totalSpendDisplay: money(totalSpendNum),
  };
}

export { formatCompact };
