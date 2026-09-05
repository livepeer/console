"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";

export function ReferralCard({
  referralUrl,
  compact = false,
}: {
  referralUrl: string | null;
  compact?: boolean;
}) {
  async function copyReferralUrl() {
    if (!referralUrl) return;
    try {
      await navigator.clipboard.writeText(referralUrl);
      toast("copied to clipboard");
    } catch {
      toast.error("Couldn’t copy the link. Please try again.");
    }
  }

  return (
    <button
      type="button"
      onClick={copyReferralUrl}
      disabled={!referralUrl}
      aria-label={
        referralUrl ? "Copy referral link" : "Referral link unavailable"
      }
      className={`flex aspect-video ${compact ? "max-w-[280px]" : ""} w-full flex-col rounded-sm border border-border bg-card p-3 text-left text-card-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-default`}
    >
      <p className="text-ui-caption font-medium text-card-foreground">
        Refer a friend
      </p>
      <div className="mt-auto flex min-w-0 w-full items-center gap-2">
        {referralUrl ? (
          <>
            <code
              title={referralUrl}
              dir="rtl"
              className="min-w-0 flex-1 truncate text-left font-sans text-[11.5px] leading-4 text-muted-foreground"
            >
              {referralUrl}
            </code>
            <Copy
              className="h-3 w-3 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          </>
        ) : (
          <span className="text-xs leading-relaxed text-muted-foreground">
            Referral link temporarily unavailable.
          </span>
        )}
      </div>
    </button>
  );
}
