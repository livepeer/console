import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  /** Optional trailing content (e.g. action buttons) rendered to the right. */
  trailing?: ReactNode;
  className?: string;
}

/**
 * Breadcrumb — tiny in-content navigation strip for deep routes.
 *
 * Lives inside the page content area (not the sidebar) so each page owns its
 * own context. The last item is treated as the current page (no link, white
 * text). Earlier items render as muted links.
 */
export default function Breadcrumb({
  items,
  trailing,
  className = "",
}: BreadcrumbProps) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-2 text-xs text-fg-faint ${className}`}
    >
      <ol className="flex min-w-0 flex-1 items-center gap-1.5">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && (
                <ChevronRight
                  className="h-3 w-3 shrink-0 text-fg-disabled"
                  aria-hidden="true"
                />
              )}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="truncate transition-colors hover:text-fg"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={`truncate ${isLast ? "text-fg" : ""}`}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </nav>
  );
}
