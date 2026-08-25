"use client";

import { useEffect, useState } from "react";

type MeBillingResponse =
  | { mode: "owner_rollup"; code: string }
  | { mode: "merchant" };

export default function EndUserMeBillingNote() {
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/pymthouse/me-billing", {
        cache: "no-store",
      });
      if (!response.ok || cancelled) return;
      const body = (await response.json()) as MeBillingResponse;
      if (cancelled) return;
      if (body.mode === "owner_rollup") {
        setNote(
          "Your usage is billed to the app owner. This app is on owner_rollup, so end-user prepaid wallet and subscription reads are not available."
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!note) return null;
  return (
    <p className="mb-4 text-[13px] text-fg-muted" role="status">
      {note}
    </p>
  );
}
