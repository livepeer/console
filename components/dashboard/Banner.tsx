import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface BannerProps {
  /** Optional leading icon (lucide). Tinted in the accent. */
  icon?: ReactNode;
  /** The body text (left side). Can include inline emphasis. */
  children: ReactNode;
  /** Optional right-aligned action: label + href. Renders as a green-accented link. */
  action?: { label: string; href: string };
}

/**
 * Banner — slim inline callout above content.
 *
 * Per the Livepeer Console design (Apr 2026): mid-tone background, hairline
 * border, accent-tinted leading icon, optional accent action on the right.
 * Used for free-tier capacity, deprecation notices, and similar low-urgency
 * full-width chrome.
 */
export default function Banner({ icon, children, action }: BannerProps) {
  return (
    <div className="flex items-center gap-2.5 rounded-md border border-hairline bg-dark-lighter shadow-card px-3.5 py-2.5 text-[12.5px] text-fg-strong">
      {icon && <span className="shrink-0 text-green-bright">{icon}</span>}
      <span className="min-w-0 flex-1">{children}</span>
      {action && (
        <Link
          href={action.href}
          className="ml-auto inline-flex shrink-0 items-center gap-1 font-medium text-green-bright transition-colors hover:text-green-light"
        >
          {action.label}
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
