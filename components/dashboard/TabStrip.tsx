"use client";

import { motion } from "framer-motion";
import type { ElementType, ReactNode } from "react";

export interface TabStripItem<T extends string = string> {
  key: T;
  label: ReactNode;
  /** Optional Lucide icon (or any component). Renders to the left of the label. */
  icon?: ElementType;
  /** Optional aria-label override; defaults to `label` if `label` is a string. */
  ariaLabel?: string;
}

interface TabStripProps<T extends string = string> {
  tabs: TabStripItem<T>[];
  active: T;
  onChange: (key: T) => void;
  /**
   * Stable id used by Framer Motion's `layoutId` so the active indicator
   * slides smoothly between tabs. Pass a unique string per surface (e.g.
   * "settings-tabs", "explore-categories") to avoid collisions when multiple
   * strips are mounted at once.
   */
  layoutId: string;
  /** ARIA label for the tablist. */
  ariaLabel?: string;
  /** Optional className applied to the outer scroll container. */
  className?: string;
}

/**
 * TabStrip — horizontal pill tab strip with a sliding active indicator.
 *
 * Used across:
 *  - `/dashboard/settings` (Account / API Tokens / Billing)
 *  - `/dashboard/network` (Overview / Utilization / Payments / GPUs)
 *  - `/dashboard/explore` (the Tasks/category row)
 *
 * The active indicator uses `motion.div` with a shared `layoutId` so it slides
 * between tabs instead of snapping. Overflow is `scrollbar-none` horizontal —
 * tabs scroll on narrow viewports without a scrollbar peek.
 */
export default function TabStrip<T extends string = string>({
  tabs,
  active,
  onChange,
  layoutId,
  ariaLabel,
  className = "",
}: TabStripProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`scrollbar-none -mx-1 flex items-center gap-1 overflow-x-auto ${className}`}
    >
      {tabs.map(({ key, label, icon: Icon, ariaLabel: tabAriaLabel }) => {
        const isActive = key === active;
        return (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-label={
              tabAriaLabel ?? (typeof label === "string" ? label : undefined)
            }
            onClick={() => onChange(key)}
            className={`relative flex h-10 shrink-0 items-center gap-2 px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-bright/40 ${
              isActive
                ? "font-medium text-fg"
                : "text-fg-faint hover:text-fg-strong"
            }`}
          >
            {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
            {label}
            {isActive && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-x-0 -bottom-px h-[2px] bg-green-bright"
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 32,
                  mass: 0.6,
                }}
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
