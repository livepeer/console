"use client";

import { useState, type ReactNode } from "react";

/**
 * Shared building blocks for the settings sub-views (General / Members /
 * Billing / Limits / Profile / Notifications / Security).
 *
 * Mirrors the v7 prototype's `settings-view.jsx` primitives — `Field`, `Card`,
 * `SettingsHeader`, `Toggle`, plus the `settings-table` row vocabulary, the
 * `role-pill` swatches, and the `settings-input*` form controls. The point of
 * this file is that every settings section reads as the *same* component
 * vocabulary; new sections shouldn't need bespoke field/card markup.
 */

// ─── Inputs ─────────────────────────────────────────────────────────────────

const INPUT_BASE =
  "h-9 w-full rounded-[6px] border border-hairline bg-dark px-3 text-[13.5px] text-fg placeholder:text-fg-disabled transition-colors focus:border-green focus:outline-none disabled:opacity-60";

export function SettingsInput({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${INPUT_BASE} ${className}`} {...props} />;
}

export function SettingsTextarea({
  className = "",
  rows = 3,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={rows}
      className={`min-h-[56px] w-full resize-y rounded-[6px] border border-hairline bg-dark px-3 py-2 text-[13.5px] leading-[1.5] text-fg placeholder:text-fg-disabled transition-colors focus:border-green focus:outline-none ${className}`}
      {...props}
    />
  );
}

export function SettingsSelect({
  className = "",
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`${INPUT_BASE} appearance-none bg-[length:14px_14px] bg-no-repeat pr-7 ${className}`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2376767a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>\")",
        backgroundPosition: "right 8px center",
      }}
      {...props}
    />
  );
}

/**
 * Bordered group containing a prefix/suffix and a flush input — e.g. the
 * `livepeer.org/w/{slug}` workspace URL field, the `$` spend cap field.
 * Suppresses the inner input's border so the group draws a single perimeter.
 */
export function SettingsInputGroup({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-9 w-full items-stretch rounded-[6px] border border-hairline bg-dark transition-colors focus-within:border-green">
      {children}
    </div>
  );
}

export function InputAffix({
  children,
  side = "left",
  dim = false,
}: {
  children: ReactNode;
  side?: "left" | "right";
  dim?: boolean;
}) {
  return (
    <span
      className={`flex items-center px-3 font-mono text-[12.5px] ${
        dim ? "text-fg-faint" : "text-fg-strong"
      } ${side === "left" ? "border-r border-hairline" : ""}`}
    >
      {children}
    </span>
  );
}

/** A bare input, no border, intended for use *inside* `SettingsInputGroup`. */
export function GroupInput({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`min-w-0 flex-1 bg-transparent px-3 text-[13.5px] text-fg placeholder:text-fg-disabled outline-none ${className}`}
      {...props}
    />
  );
}

// ─── Layout primitives ──────────────────────────────────────────────────────

/**
 * Section header — a title + optional subtitle on the left, optional action
 * cluster on the right. `~/.cap-card-title` analog: 17px medium with negative
 * letter-spacing per the prototype.
 */
export function SettingsHeader({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mt-7 mb-3 flex items-end justify-between gap-3 first:mt-0">
      <div>
        <h2 className="text-[17px] font-medium leading-tight tracking-[-0.01em] text-fg">
          {title}
        </h2>
        {sub && (
          <p className="mt-[3px] text-[12.5px] text-fg-faint">{sub}</p>
        )}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

/**
 * Settings card — bordered, rounded panel that holds `SettingsField` rows.
 * `danger` variant uses a red-tinted border (used for the Delete-workspace
 * block).
 */
export function SettingsCard({
  children,
  danger = false,
  padded = false,
  className = "",
}: {
  children: ReactNode;
  danger?: boolean;
  /** When true, wraps content in a single padded box instead of a fields list (used for plan grids, member tables, empty states). */
  padded?: boolean;
  className?: string;
}) {
  const border = danger ? "border-red-400/20" : "border-hairline";
  return (
    <div
      // `shadow-card` is theme-aware: a no-op `0 0 0 transparent` in dark
      // (cards there are defined by their bg-dark-lighter elevation alone),
      // and a faint warm 1–2px shadow in light so panels read as real
      // surfaces instead of wireframe outlines on near-white canvas.
      className={`overflow-hidden rounded-md border ${border} bg-dark-lighter shadow-card ${
        padded ? "p-0" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Settings field — a labeled row inside a `SettingsCard`. Layout: label +
 * optional hint stacked at the top, optional inline action button on the
 * right of the label row, control(s) on a second row below.
 */
export function SettingsField({
  label,
  hint,
  action,
  children,
}: {
  label: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-hairline px-[18px] py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13.5px] font-medium text-fg">{label}</p>
          {hint && (
            <p className="mt-0.5 max-w-[60ch] text-[12px] text-fg-faint">
              {hint}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="mt-3 flex items-center gap-2">{children}</div>
    </div>
  );
}

// ─── Buttons ────────────────────────────────────────────────────────────────

/**
 * Quiet button used throughout the settings views (Upload / Remove /
 * Transfer / Change / Configure / Connect / Add card / Filter / Invite /
 * Download all). Mirrors the prototype's `.icon-btn`.
 */
export function IconButton({
  children,
  primary = false,
  danger = false,
  ghost = false,
  dim = false,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  primary?: boolean;
  danger?: boolean;
  ghost?: boolean;
  dim?: boolean;
}) {
  const tone = primary
    // `.btn-primary` is the theme-aware CTA recipe — green in dark, neutral
    // zinc-900 in light. Recipe paints its own edge-highlight border
    // (`--color-cta-border` = one step lighter than the bg).
    ? "btn-primary"
    : danger
      ? "border-red-400/30 bg-transparent text-red-400 hover:bg-red-400/[0.08]"
      : ghost
        ? "border-transparent bg-transparent text-fg-faint hover:bg-hover hover:text-fg-strong"
        : dim
          ? "border-transparent bg-transparent text-fg-faint hover:bg-hover hover:text-fg-muted"
          : "border-hairline bg-dark-card text-fg-strong hover:border-subtle hover:bg-hover hover:text-fg";
  return (
    <button
      type="button"
      className={`inline-flex h-[26px] items-center gap-1.5 rounded-[4px] border px-2.5 text-[12.5px] transition-colors focus:outline-none ${tone} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

// ─── Pills ──────────────────────────────────────────────────────────────────

export type RolePillTone =
  | "owner"
  | "admin"
  | "developer"
  | "viewer"
  | "active"
  | "paused";

// Tone classes (`tone-cyan` / `tone-violet` / `tone-amber`) are theme-aware
// recipes defined in `app/globals.css` — each sets fg + bg + border in one
// shot. The `owner` / `active` greens and the `viewer` neutral don't need
// theme overrides because `text-green-bright` already steps down in light
// mode (see globals.css `[data-theme="light"]` accent override).
const ROLE_PILL_STYLES: Record<RolePillTone, string> = {
  owner:
    "border-green/30 bg-green/15 text-green-bright",
  admin: "tone-violet",
  developer: "tone-cyan",
  viewer:
    "border-transparent text-fg-faint",
  active:
    "border-green/30 bg-green/15 text-green-bright",
  paused: "tone-amber",
};

export function RolePill({
  tone,
  children,
}: {
  tone: RolePillTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-px font-mono text-[10.5px] uppercase tracking-[0.04em] ${ROLE_PILL_STYLES[tone]}`}
    >
      {children}
    </span>
  );
}

// ─── Avatars ────────────────────────────────────────────────────────────────

/**
 * Settings avatar — 32×32 monogram tile. `lp` variant uses the green accent
 * with a hairline. Other variants accept an explicit hex/rgb color via
 * `color`.
 */
export function SettingsAvatar({
  initials,
  color,
  variant = "neutral",
  size = 32,
}: {
  initials: string;
  color?: string;
  variant?: "neutral" | "lp";
  size?: number;
}) {
  return (
    <span
      // `text-white` constant — avatars always sit on a saturated background
      // (green, blue, amber, etc.) and want white initials in both themes,
      // regardless of `text-fg` flipping with the theme.
      className="grid shrink-0 place-items-center rounded-[7px] font-semibold tracking-[0.02em] text-white"
      style={{
        width: size,
        height: size,
        background: variant === "lp" ? "var(--color-green)" : color ?? "#3a3a3c",
        fontSize: size <= 24 ? 10.5 : 12.5,
        border: variant === "lp" ? "1px solid var(--color-green-light)" : undefined,
      }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

// ─── Toggles ────────────────────────────────────────────────────────────────

/**
 * Mini toggle — 28×16 px iOS-style switch. Local state only; in production
 * settings each row would lift state up to a form controller.
 */
export function MiniToggle({
  defaultOn = false,
  onChange,
}: {
  defaultOn?: boolean;
  onChange?: (on: boolean) => void;
}) {
  const [on, setOn] = useState(defaultOn);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => {
        setOn((v) => {
          onChange?.(!v);
          return !v;
        });
      }}
      className={`relative h-4 w-7 rounded-full transition-colors ${
        on ? "bg-green-bright" : "bg-pop"
      }`}
    >
      <span
        // White thumb with a thin tinted shadow so the thumb stays visible on
        // light mode where the OFF track (`bg-pop` ≈ rgba(9,9,11,0.08)) is
        // very faint against the page. The shadow is essentially invisible on
        // dark and provides a soft outline on light.
        className="absolute top-0.5 left-0.5 block h-3 w-3 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.18)] transition-[left] duration-150"
        style={{ left: on ? 14 : 2 }}
      />
    </button>
  );
}

// ─── Tables ─────────────────────────────────────────────────────────────────

/**
 * 4-column settings table layout class. Used by Members, Sessions, Invites.
 */
export const ST_COLS_4 =
  "grid items-center gap-3 px-[18px] py-3 grid-cols-[1.6fr_0.7fr_0.6fr_60px]";

/**
 * 5-column settings table layout class. Used by Invoices and Webhooks.
 */
export const ST_COLS_5 =
  "grid items-center gap-3 px-[18px] py-3 grid-cols-[1.4fr_0.9fr_0.9fr_1.5fr_0.9fr]";

/**
 * Mono-uppercase column-header style applied to the head row of a settings
 * table. Pairs with `ST_COLS_*`.
 */
export const ST_HEAD_CLASS =
  "border-b border-hairline bg-dark py-2 font-mono text-[10.5px] uppercase tracking-[0.06em] text-fg-disabled";
