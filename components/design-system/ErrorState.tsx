"use client";

import { AlertTriangle, ExternalLink, RefreshCw } from "lucide-react";
import { useMemo } from "react";
import RequestIdChip from "@/components/dashboard/RequestIdChip";
import { generateMockRequestId } from "@/lib/dashboard/utils";
import { EXTERNAL_LINKS } from "@/lib/constants";

interface ErrorStateProps {
  /** Headline. Default: "Something went wrong". */
  title?: string;
  /** Explanatory copy under the title. Default: a generic 1-liner. */
  description?: string;
  /** Optional request / inference ID. Quoteable to support. If omitted, a
   *  mock ID is generated so the user always has something to reference. */
  requestId?: string;
  /** Retry handler. When omitted, the retry button is hidden. */
  onRetry?: () => void;
  /** Tighter padding for use inline (e.g. inside a chart slot). Default false. */
  compact?: boolean;
}

/**
 * ErrorState — the canonical error surface for any dashboard data view.
 * Replaces blank screens and bare "Something went wrong" lines with:
 *  - clear cause-agnostic headline
 *  - retry affordance (when supplied by caller)
 *  - a request ID the user can quote to support
 *  - a Discord link as the fallback escalation
 *
 * Used both inline (chart/table fallback) and as the body of route-level
 * error.tsx boundaries.
 */
export default function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this view. The issue has been logged — try again, or reach out with the request ID below.",
  requestId,
  onRetry,
  compact = false,
}: ErrorStateProps) {
  // Pin a generated ID across renders so each instance has one stable value.
  const id = useMemo(() => requestId ?? generateMockRequestId(), [requestId]);

  return (
    <div
      role="alert"
      className={`flex flex-col items-start gap-3 rounded-xl border border-hairline bg-dark-card/40 ${
        compact ? "p-4" : "p-6"
      }`}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-warm/10">
        <AlertTriangle
          className="h-4 w-4 text-warm"
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="max-w-xl text-[13px] text-fg-muted">{description}</p>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white/[0.06] px-3 text-[12px] font-medium text-white transition-colors hover:bg-white/[0.1]"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            Try again
          </button>
        )}
        <RequestIdChip id={id} />
        <a
          href={EXTERNAL_LINKS.discord}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[12px] text-fg-faint transition-colors hover:text-white"
        >
          Get help on Discord
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
