"use client";

import Link from "next/link";
import {
  ChevronRight,
  ExternalLink,
  Lock,
  type LucideIcon,
} from "lucide-react";
import Tooltip from "@/components/ui/Tooltip";

interface NavLinkProps {
  href: string;
  icon: LucideIcon;
  label: string;
  active?: boolean;
  collapsed?: boolean;
  external?: boolean;
  /** Locked = workspace-only route shown to a logged-out user. Renders dimmer
   *  icon/label + a small lock icon on the right (replacing `meta`). The link
   *  still navigates — the destination route is expected to render a sign-in
   *  wall instead of its content, so the lock is purely a visual signal. */
  locked?: boolean;
  /** Right-aligned mono count badge (e.g. `47`, `1.2K`, `3`). Hidden when
   *  collapsed. Mutually exclusive with `kbd` and `submenu`. */
  meta?: string;
  /** Right-aligned keyboard hint, dimmer than `meta` (e.g. `G H`). Per the v6
   *  prototype's `nav-kbd`. Hidden when collapsed. Mutually exclusive with
   *  `meta`. */
  kbd?: string;
  /** Renders a chev-right at the end, signaling that this row leads into a
   *  sub-experience (the v6 prototype uses this on the Settings nav item to
   *  hint that clicking swaps the sidebar to a settings rail). Suppresses
   *  `meta`/`kbd`/`external` rendering. */
  submenu?: boolean;
  onNavigate?: () => void;
}

/**
 * NavLink — sidebar nav row.
 *
 * Density per the Livepeer Console design (Apr 2026): 26px tall, 13px text,
 * gap-2, px-2.5. Active = `bg-active` (white at 7%) + white label + white icon.
 * The right-aligned `meta` slot (mono, 11px, fg-label) carries counts/badges
 * inline so the row stays scannable.
 */
export default function NavLink({
  href,
  icon: Icon,
  label,
  active = false,
  collapsed = false,
  external = false,
  locked = false,
  meta,
  kbd,
  submenu = false,
  onNavigate,
}: NavLinkProps) {
  const base =
    "group relative flex h-[26px] items-center rounded-[4px] text-[13px] font-medium transition-colors";
  const state = active
    ? "bg-active text-fg"
    : locked
      ? "text-fg-faint hover:bg-hover hover:text-fg-strong"
      : "text-fg-strong hover:bg-hover hover:text-fg";
  const layout = collapsed ? "mx-auto w-[26px] justify-center" : "w-full gap-2 px-2.5";
  const className = `${base} ${state} ${layout}`;

  const content = (
    <>
      <Icon
        className={`h-3.5 w-3.5 shrink-0 ${
          active
            ? "text-fg"
            : locked
              ? "text-fg-disabled"
              : "text-fg-label"
        }`}
        aria-hidden="true"
      />
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {locked ? (
            <Lock
              className="h-3 w-3 shrink-0 text-fg-disabled"
              aria-hidden="true"
            />
          ) : submenu ? (
            <ChevronRight
              className="-mr-0.5 h-3.5 w-3.5 shrink-0 text-fg-faint"
              aria-hidden="true"
            />
          ) : (
            <>
              {meta && (
                <span className="shrink-0 font-mono text-[11px] text-fg-label tabular-nums">
                  {meta}
                </span>
              )}
              {kbd && (
                <span className="shrink-0 font-mono text-[10.5px] tracking-[0.04em] text-fg-disabled">
                  {kbd}
                </span>
              )}
              {external && (
                <ExternalLink
                  className="h-3 w-3 shrink-0 text-fg-disabled"
                  aria-hidden="true"
                />
              )}
            </>
          )}
        </>
      )}
    </>
  );

  const linkEl = external ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={collapsed ? label : undefined}
      className={className}
      onClick={onNavigate}
    >
      {content}
    </a>
  ) : (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      className={className}
      onClick={onNavigate}
    >
      {content}
    </Link>
  );

  if (collapsed) {
    // Tooltip wraps its trigger in an inline-flex span that sizes to the
    // child — `mx-auto` on the link has no slack to consume inside it. Wrap
    // the whole tooltip in a flex container so the 26px button centers
    // within the sidebar's padded inner width.
    return (
      <div className="flex justify-center">
        <Tooltip content={label} side="right">
          {linkEl}
        </Tooltip>
      </div>
    );
  }

  return linkEl;
}
