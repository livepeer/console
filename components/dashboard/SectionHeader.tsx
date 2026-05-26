import type { ReactNode } from "react";

interface SectionHeaderProps {
  /** The section title (renders as h2). */
  title: string;
  /** Optional one-line description below the title. Only shown when `variant="default"`. */
  description?: string;
  /** Optional content rendered to the right of the title — typically a "View all →" link or a control. */
  action?: ReactNode;
  /** Optional count rendered as a mono pill next to the title (mono variant only). */
  count?: number | string;
  /** Visual treatment.
   *  - `mono` (default): mono uppercase 11px label with optional count chip. Linear-style chrome.
   *  - `default`: title-cased h2 at the size below.
   *  - `lg`: title-cased h2 at the largest size. */
  variant?: "mono" | "default" | "lg";
  /** Visual size for the `default` and `lg` variants. */
  size?: "default" | "lg";
  /** Optional className for the wrapper (margin, etc.). Default `mb-3` for mono, `mb-4` otherwise. */
  className?: string;
}

/**
 * Dashboard SectionHeader — distinct from `components/ui/SectionHeader.tsx`
 * (which is for marketing hero typography).
 *
 * Default variant per the Livepeer Console design (Apr 2026): mono-uppercase
 * 11px label with an optional count chip on the right. Pairs with the dense
 * Linear-style content blocks beneath.
 */
export default function SectionHeader({
  title,
  description,
  action,
  count,
  variant = "mono",
  size,
  className,
}: SectionHeaderProps) {
  if (variant === "mono") {
    // className is additive — extends the default flex layout rather than
    // replacing it, so callers can tweak margins without losing the mono row.
    return (
      <div className={`flex items-baseline gap-2 pt-7 pb-2.5 ${className ?? ""}`}>
        <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-fg-faint">
          {title}
        </h2>
        {count !== undefined && (
          <span className="rounded-full border border-hairline bg-dark-card px-1.5 py-0 font-mono text-[10.5px] tabular-nums text-fg-faint">
            {count}
          </span>
        )}
        <span className="flex-1" />
        {action && <span className="text-[12px] text-fg-faint">{action}</span>}
      </div>
    );
  }

  // Legacy title-cased variants (kept for any caller still using them).
  const effectiveSize = size ?? (variant === "lg" ? "lg" : "default");
  const titleClass =
    effectiveSize === "lg"
      ? "text-lg font-medium text-fg text-balance"
      : "text-base font-medium text-fg text-balance";

  return (
    <div className={className ?? "mb-4"}>
      <div className="flex items-center justify-between gap-3">
        <h2 className={titleClass}>{title}</h2>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {description && (
        <p className="mt-1 text-sm text-fg-faint text-balance">{description}</p>
      )}
    </div>
  );
}
