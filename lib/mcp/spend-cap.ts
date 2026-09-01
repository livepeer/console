import { defaultSpendCapUsd } from "./env";

type CapState = { capUsd: number; spentUsd: number; count: number };

const byPrincipal = new Map<string, CapState>();

function state(id: string): CapState {
  const existing = byPrincipal.get(id);
  if (existing) return existing;
  const created = { capUsd: defaultSpendCapUsd(), spentUsd: 0, count: 0 };
  byPrincipal.set(id, created);
  return created;
}

export function readSpendCap(principalId: string): CapState {
  return { ...state(principalId) };
}

export function setSpendCap(principalId: string, capUsd: number): CapState {
  const max = defaultSpendCapUsd();
  if (capUsd > max) {
    throw new Error(`cap_usd cannot exceed campaign max $${max}`);
  }
  const current = state(principalId);
  current.capUsd = capUsd;
  return { ...current };
}

export function resetSpendCap(principalId: string): CapState {
  const current = state(principalId);
  current.capUsd = defaultSpendCapUsd();
  return { ...current };
}

export function assertSpendHeadroom(principalId: string, estimateUsd: number): void {
  const current = state(principalId);
  if (current.spentUsd + estimateUsd > current.capUsd) {
    throw new Error(
      `spend_cap exceeded: $${current.spentUsd.toFixed(4)} spent of $${current.capUsd} cap`
    );
  }
}

export function recordSpend(principalId: string, usd: number): void {
  const current = state(principalId);
  current.spentUsd += usd;
  current.count += 1;
}
