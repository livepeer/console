"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { ReactNode } from "react";

interface CopyButtonProps {
  /** The string copied to the clipboard. */
  value: string;
  /** Visible label. Hidden when `iconOnly` or below `sm:` for `bordered` variant. Default "Copy". */
  label?: string;
  /** Compact icon-only variant — just the Copy / Check icon. */
  iconOnly?: boolean;
  /**
   * `ghost` (default) — quiet, no border, used inside chrome panels.
   * `bordered` — outlined button, used as a top-level action (e.g. model-detail "Copy ID").
   */
  variant?: "ghost" | "bordered";
  /** Visual size. `xs` for inline-with-text, `sm` for default, `md` for prominent. Default `sm`. */
  size?: "xs" | "sm" | "md";
  /** ARIA label override (defaults to `Copy {label}`). */
  ariaLabel?: string;
  /** Override the timeout before reverting from "Copied" state. Default 1600ms. */
  timeoutMs?: number;
  /** Optional className applied to the button (alignment, ml-auto, etc.). */
  className?: string;
  /** Optional callback after a successful copy (e.g. tracking). */
  onCopy?: () => void;
  /** Optional content rendered before the icon — e.g. a key prefix. */
  children?: ReactNode;
  /** Hide the label on small screens (icon-only on mobile). Useful for `bordered` action buttons. */
  hideLabelOnMobile?: boolean;
}

/**
 * CopyButton — canonical "click to copy" affordance for dashboard surfaces.
 *
 * Pattern (matches the original KeyBadge implementation):
 *  - Default state: Copy icon + label, neutral styling
 *  - Copied state (1.6s): Check icon + "Copied" label, green-bright background flash
 *
 * Replaces inline copy implementations in CodeSnippets, PlaygroundOutput's JSON
 * tab, TranscodingOutput, and the model-detail "Copy ID" button. Used inside
 * KeyBadge as well.
 */
export default function CopyButton({
  value,
  label = "Copy",
  iconOnly = false,
  variant = "ghost",
  size = "sm",
  ariaLabel,
  timeoutMs = 1600,
  className = "",
  onCopy,
  children,
  hideLabelOnMobile = false,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      onCopy?.();
      window.setTimeout(() => setCopied(false), timeoutMs);
    });
  };

  const sizing =
    size === "xs"
      ? "h-6 gap-1 px-1.5 text-[10px]"
      : size === "md"
        ? "h-8 gap-1.5 px-2.5 text-xs"
        : "h-7 gap-1.5 px-2 text-[11px]";
  const iconSize = size === "md" ? "h-3.5 w-3.5" : "h-3 w-3";

  const stateStyles =
    variant === "bordered"
      ? copied
        ? "border border-green-bright/30 bg-green-bright/15 text-green-bright"
        : "border border-subtle text-fg-strong hover:border-strong hover:bg-hover hover:text-fg"
      : copied
        ? "bg-green-bright/15 text-green-bright"
        : "text-fg-muted hover:bg-tint hover:text-fg";

  const finalLabel = copied ? "Copied" : label;
  const showLabel = !iconOnly;
  const labelClassName = hideLabelOnMobile ? "hidden sm:inline" : "";

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Copied" : (ariaLabel ?? `Copy ${label.toLowerCase()}`)}
      aria-live="polite"
      className={`inline-flex shrink-0 items-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-bright/40 ${sizing} ${stateStyles} ${className}`}
    >
      {children}
      {copied ? (
        <Check className={`${iconSize} shrink-0`} aria-hidden="true" />
      ) : (
        <Copy className={`${iconSize} shrink-0`} aria-hidden="true" />
      )}
      {showLabel && <span className={labelClassName}>{finalLabel}</span>}
    </button>
  );
}
