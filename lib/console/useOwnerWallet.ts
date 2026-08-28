"use client";

/** Placeholder until the wallet PR replaces this hook. */
export function useWalletBillingState(_enabled: boolean): {
  state:
    | { status: "idle" }
    | { status: "loading" }
    | { status: "ready"; wallet: { billingState: unknown } }
    | { status: "error"; message: string };
} {
  return { state: { status: "idle" } };
}
