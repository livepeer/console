"use client";

import CopyButton from "@/components/dashboard/CopyButton";

interface RequestIdChipProps {
  /** The full request ID. Rendered monospace; copy button copies the full value. */
  id: string;
  /** Optional className for layout (margins, alignment). */
  className?: string;
}

/**
 * RequestIdChip — copyable monospace chip for showing request / inference IDs
 * in playground output, error states, and (later) the activity log row drawer.
 *
 * The chip is the canonical surface for "the thing you'd quote to support."
 * Always full-width visible at sm:; truncates with the last 8 chars on mobile.
 */
export default function RequestIdChip({ id, className = "" }: RequestIdChipProps) {
  // Truncated form for narrow screens — last 8 chars after the prefix so the
  // shape ("req_…abcd1234") is recognizable even when collapsed.
  const tail = id.length > 12 ? `…${id.slice(-8)}` : id;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border border-hairline bg-zebra py-0.5 pl-2 pr-1 ${className}`}
    >
      <span className="font-mono text-[11px] text-fg-muted">
        <span className="hidden sm:inline">{id}</span>
        <span className="sm:hidden">{tail}</span>
      </span>
      <CopyButton
        value={id}
        iconOnly
        size="xs"
        ariaLabel="Copy request ID"
      />
    </span>
  );
}
