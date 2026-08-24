"use client";

/** Placeholder until the wallet/payment-methods PR replaces this hook. */
export function useBillingAccount(_enabled: boolean): {
  state: {
    status: "idle" | "loading" | "ready" | "error";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    paymentMethods: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    invoices: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subscriptions: any[];
    paymentMethodsError: null;
    invoicesError: null;
    subscriptionsError: null;
    message?: string;
  };
  reload: () => Promise<void>;
  startPaymentMethodCheckout: (
    input?: unknown
  ) => Promise<{ checkoutUrl: string }>;
  openInvoice: (
    input: unknown
  ) => Promise<{ hostedInvoiceUrl: string; invoicePdf: string }>;
  setDefaultPaymentMethod: (input: unknown) => Promise<void>;
  ensureDefaultPaymentMethod: (input?: unknown) => Promise<void>;
  removePaymentMethod: (input: unknown) => Promise<void>;
} {
  return {
    state: {
      status: "ready",
      paymentMethods: [],
      invoices: [],
      subscriptions: [],
      paymentMethodsError: null,
      invoicesError: null,
      subscriptionsError: null,
    },
    reload: async () => {},
    startPaymentMethodCheckout: async () => ({ checkoutUrl: "" }),
    openInvoice: async () => ({ hostedInvoiceUrl: "", invoicePdf: "" }),
    setDefaultPaymentMethod: async () => {},
    ensureDefaultPaymentMethod: async () => {},
    removePaymentMethod: async () => {},
  };
}
