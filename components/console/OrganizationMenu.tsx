"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  LogOut,
  Palette,
  Settings,
  User,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { THEME_OPTIONS, useTheme } from "@/components/console/ThemeContext";

interface MenuUser {
  name: string;
  email: string;
  initials: string;
}

interface OrganizationMenuProps {
  user: MenuUser;
  disconnect: () => void;
  collapsed: boolean;
}

/**
 * The sidebar account menu.
 *
 * Trigger is the workspace: the user's initials and their first name. The
 * workspace was labelled "Personal", which is a tautology while everyone has
 * exactly one — it named the category instead of the thing. The first name
 * answers the question the label is actually there for, which is whose
 * console this is; a creator with a personal and a work Google login can tell
 * them apart at a glance. It is also the shape the switcher wants when
 * organizations land, with team names sitting alongside the personal one.
 *
 * The full name and email stay inside the menu — the rail is 232px and an
 * email truncates to noise on the trigger.
 *
 * Order inside, top to bottom: who you are, which workspace you're in, then
 * what you can do. Actions last because they're the only part you scan for
 * after the first week.
 *
 * This used to be an organization switcher over a hardcoded list containing
 * "Flipbook" — a made-up company that read as live customer data in every
 * demo — plus Create organization, Invite members and Billing. None of it was
 * real; the console has no multi-tenancy. WORKSPACES keeps a one-row list
 * because that is the honest shape of it today and the place a second entry
 * goes when organizations arrive.
 */
export default function OrganizationMenu({
  user,
  disconnect,
  collapsed,
}: OrganizationMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { preference, setPreference } = useTheme();

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // AuthContext guarantees a non-empty name (it falls back to the email's
  // local part, then "User"), so this is never blank.
  const firstName = user.name.split(" ")[0] || user.name;

  const workspaceTile = (
    <span
      // `text-white` constant — the tile background is a saturated accent, so
      // the monogram wants a constant white in both themes.
      className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[5px] border border-green-light text-[10.5px] font-semibold tracking-[0.02em] text-white"
      style={{ background: "var(--color-green)" }}
      aria-hidden="true"
    >
      {user.initials}
    </span>
  );

  const itemClass =
    "flex w-full items-center gap-2.5 rounded-[4px] px-2 py-1.5 text-left text-[13px] text-fg-strong transition-colors hover:bg-hover hover:text-fg";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={`Account menu for ${user.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title={collapsed ? firstName : undefined}
        className={
          collapsed
            ? `flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
                open ? "bg-tint" : "hover:bg-hover"
              }`
            : `flex w-full items-center gap-2 rounded-md px-1.5 py-1 transition-colors ${
                open ? "bg-tint" : "hover:bg-hover"
              }`
        }
      >
        {workspaceTile}
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate text-left text-[13.5px] font-medium text-fg">
              {firstName}
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 text-fg-faint transition-transform duration-150 ${
                open ? "rotate-180 text-fg-strong" : ""
              }`}
              aria-hidden="true"
            />
          </>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-orientation="vertical"
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className={`absolute z-[100] min-w-[248px] overflow-hidden rounded-xl border border-subtle bg-[var(--color-surface-raised)] shadow-[var(--shadow-popover)] ${
              collapsed
                ? "left-full top-0 ml-2 origin-top-left"
                : "left-0 top-full mt-1 origin-top-left"
            }`}
          >
            {/* Identity */}
            <div className="px-3 pt-3 pb-2.5 leading-tight">
              <p className="truncate text-[13px] font-medium text-fg">
                {user.name}
              </p>
              <p className="mt-1 truncate text-[11.5px] text-fg-faint">
                {user.email}
              </p>
            </div>

            <div className="h-px bg-hairline" />

            {/* Workspaces */}
            <div className="flex flex-col gap-px p-1.5">
              <p className="px-2 pt-1 pb-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.06em] text-fg-disabled">
                Workspaces
              </p>
              <button
                type="button"
                role="menuitemradio"
                aria-checked="true"
                onClick={() => setOpen(false)}
                className={`${itemClass} bg-hover`}
              >
                <User
                  className="h-3.5 w-3.5 shrink-0 text-fg-faint"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate">{firstName}</span>
                <Check
                  className="h-3.5 w-3.5 shrink-0 text-green-bright"
                  aria-hidden="true"
                />
              </button>
            </div>

            <div className="h-px bg-hairline" />

            {/* Actions */}
            <div className="flex flex-col gap-px p-1.5">
              <Link
                href="/settings"
                role="menuitem"
                onClick={() => setOpen(false)}
                className={itemClass}
              >
                <Settings
                  className="h-3.5 w-3.5 shrink-0 text-fg-faint"
                  aria-hidden="true"
                />
                Settings
              </Link>
              {/* Theme, as the same three choices the Appearance view offers,
                  at menu scale: the house segmented control with the same
                  icons. Selection is the stored preference, so "System" is
                  its own state rather than whichever theme it resolves to. */}
              <div className="flex items-center justify-between gap-3 rounded-[4px] px-2 py-1.5">
                <span className="flex items-center gap-2.5 text-[13px] text-fg-strong">
                  <Palette
                    className="h-3.5 w-3.5 shrink-0 text-fg-faint"
                    aria-hidden="true"
                  />
                  Theme
                </span>
                <div
                  role="radiogroup"
                  aria-label="Theme"
                  className="inline-flex items-center gap-px rounded-[5px] border border-hairline bg-dark p-px"
                >
                  {THEME_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const selected = preference === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={opt.label}
                        title={opt.label}
                        onClick={() => setPreference(opt.value)}
                        className={`grid h-6 w-7 place-items-center rounded-[4px] transition-colors duration-[var(--motion-duration-fast)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-green-bright/30 ${
                          selected
                            ? "bg-dark-card text-fg"
                            : "text-fg-faint hover:bg-hover hover:text-fg-strong"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </button>
                    );
                  })}
                </div>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  disconnect();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-[4px] px-2 py-1.5 text-left text-[13px] text-fg-faint transition-colors hover:bg-red-500/10 hover:text-red-400"
              >
                <LogOut className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
