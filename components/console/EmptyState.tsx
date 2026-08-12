import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

type Variant = "guided" | "annotated" | "teach";

interface EmptyStateAction {
  label: string;
  href: string;
  external?: boolean;
}

interface EmptyStateProps {
  /**
   * `guided` — empty state with a primary CTA to the next action.
   * `annotated` — fades a skeleton preview behind the message so users see what the data WILL look like.
   * `teach` — neutral educational state, no action.
   * Default: `guided`.
   */
  variant?: Variant;
  /** Lucide icon (or any ReactNode) shown above the title. */
  icon?: ReactNode;
  title: string;
  description?: string;
  /** CTA. Required for `guided`, optional for the other variants. */
  action?: EmptyStateAction;
  /** Skeleton content rendered behind the message in the `annotated` variant. */
  preview?: ReactNode;
  /** Override the wrapper height (e.g., `min-h-[280px]` for a chart slot). */
  className?: string;
}

/**
 * EmptyState — single primitive for "no data yet" surfaces.
 *
 * Replaces ad-hoc "No requests yet"-style copy with a tighter, friendlier
 * pattern that either drives forward (guided), shows the user what's coming
 * (annotated), or teaches the concept (teach).
 */
export default function EmptyState({
  variant = "guided",
  icon,
  title,
  description,
  action,
  preview,
  className = "",
}: EmptyStateProps) {
  const wrapperBase =
    "relative flex flex-col items-center justify-center rounded-lg border border-dashed border-hairline px-6 py-10 text-center";

  return (
    <div className={`${wrapperBase} ${className}`}>
      {/* Annotated variant: faded skeleton sits behind the message */}
      {variant === "annotated" && preview && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden opacity-30"
          aria-hidden="true"
        >
          {preview}
        </div>
      )}

      <div className="relative flex max-w-md flex-col items-center">
        {icon && (
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-hover text-fg-faint ring-1 ring-hairline">
            {icon}
          </div>
        )}
        <p className="text-sm font-medium text-fg text-balance">{title}</p>
        {description && (
          <p className="mt-1 text-xs text-fg-faint text-balance">{description}</p>
        )}
        {action && (
          <ActionLink action={action} variant={variant} className="mt-4" />
        )}
      </div>
    </div>
  );
}

function ActionLink({
  action,
  variant,
  className = "",
}: {
  action: EmptyStateAction;
  variant: Variant;
  className?: string;
}) {
  const styles =
    variant === "guided"
      ? "btn-primary rounded-full px-3.5 py-1.5 text-[13px] font-medium"
      : "text-xs font-medium text-fg-strong underline-offset-2 hover:text-fg hover:underline";

  const inner = (
    <>
      {action.label}
      <ArrowRight className="h-3 w-3" aria-hidden="true" />
    </>
  );
  const sharedClassName = `inline-flex items-center gap-1.5 transition-colors ${styles} ${className}`;

  if (action.external) {
    return (
      <a
        href={action.href}
        target="_blank"
        rel="noopener noreferrer"
        className={sharedClassName}
      >
        {inner}
      </a>
    );
  }

  return (
    <Link href={action.href} className={sharedClassName}>
      {inner}
    </Link>
  );
}
