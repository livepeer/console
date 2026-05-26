"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface KeyBadgeProps {
  /** The prefix portion of the key, e.g. `lp_fnd_x8k2`. The mask is appended automatically. */
  prefix: string;
  /** Optional label rendered above the key (e.g. "Your API key"). */
  label?: string;
  /** Visual size — `sm` is for inline use, `md` for cards. Default `md`. */
  size?: "sm" | "md";
  /** Override the masked-suffix length. Default 24. */
  maskLength?: number;
}

/**
 * KeyBadge — unified affordance for rendering an API key prefix with a Copy button.
 *
 * Used wherever a developer expects to see *their* key inline (Home, model detail
 * API tab, Tokens page). Mirrors the masking behavior in `ApiKeysTab` so the
 * clipboard payload is always `prefix + mask`. Once the real backend lands, this
 * is the single component that needs to learn how to fetch the full key.
 */
export default function KeyBadge({
  prefix,
  label,
  size = "md",
  maskLength = 24,
}: KeyBadgeProps) {
  const [copied, setCopied] = useState(false);
  const masked = `${prefix}${"•".repeat(maskLength)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(masked).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  };

  const padding = size === "sm" ? "px-2.5 py-1.5" : "px-3 py-2";
  const textSize = size === "sm" ? "text-xs" : "text-[13px]";

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <span className="text-[11px] font-medium uppercase tracking-wider text-fg-label">
          {label}
        </span>
      )}
      <div
        className={`inline-flex items-center gap-2 rounded-md border border-subtle bg-zebra ${padding}`}
      >
        <code
          className={`min-w-0 flex-1 truncate font-mono ${textSize} text-fg-strong`}
        >
          {masked}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? "Copied" : "Copy API key"}
          className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium transition-colors ${
            copied
              ? "bg-green-bright/15 text-green-bright"
              : "text-fg-muted hover:bg-tint hover:text-fg"
          }`}
        >
          {copied ? (
            <Check className="h-3 w-3" aria-hidden="true" />
          ) : (
            <Copy className="h-3 w-3" aria-hidden="true" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
