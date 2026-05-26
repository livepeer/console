"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  CreditCard,
  LogOut,
  Plus,
  Settings,
  UserPlus,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface User {
  name: string;
  email: string;
  initials: string;
}

interface Workspace {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  sub: string;
  active?: boolean;
}

interface WorkspaceMenuProps {
  user: User;
  disconnect: () => void;
  collapsed: boolean;
}

// Mock workspaces — until real multi-tenancy lands, the active workspace is
// "Flipbook" (Zain's company) and a personal workspace is shown as a second
// option. Per the Livepeer Dashboard design (Apr 2026), the dropdown also
// surfaces workspace-scoped actions (settings, invite, billing) before the
// account-level sign-out.
const WORKSPACES: Workspace[] = [
  {
    id: "flipbook",
    name: "Flipbook",
    initials: "FB",
    avatarColor: "var(--color-green)",
    sub: "flipbook.page · Pro",
    active: true,
  },
  {
    id: "personal",
    name: "Zain personal",
    initials: "ZM",
    avatarColor: "#7c3aed",
    sub: "Free",
  },
];

const dropdownVariants = {
  hidden: { opacity: 0, scale: 0.95, y: -4 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: -4 },
};

function WsAvatar({
  initials,
  color,
  size = 22,
}: {
  initials: string;
  color: string;
  size?: number;
}) {
  return (
    <span
      // `text-white` constant — the avatar background is always a saturated
      // accent (green, purple, etc.), so the initials want a constant
      // white in both themes regardless of `text-fg` flipping.
      className="grid shrink-0 place-items-center rounded-[5px] font-semibold tracking-[0.02em] text-white"
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: size <= 22 ? 10.5 : 11.5,
        border:
          color === "var(--color-green)"
            ? "1px solid var(--color-green-light)"
            : undefined,
      }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

/**
 * WorkspaceMenu — sidebar workspace switcher.
 *
 * Per the Livepeer Dashboard design (Claude Design handoff, Apr 2026):
 * shows the active workspace's avatar + name + chevron. Click to open a
 * dropdown with the list of workspaces, an action to create a new one,
 * and workspace-scoped quick links (Settings, Invite, Billing) before
 * the account-level sign-out.
 *
 * Mock-only — until real multi-tenancy exists, the active workspace is
 * always Flipbook. Switching does nothing yet.
 */
export default function WorkspaceMenu({
  user,
  disconnect,
  collapsed,
}: WorkspaceMenuProps) {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string>(
    WORKSPACES.find((w) => w.active)?.id ?? WORKSPACES[0].id,
  );
  const ref = useRef<HTMLDivElement>(null);

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

  const active = WORKSPACES.find((w) => w.id === activeId) ?? WORKSPACES[0];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={`Workspace menu for ${active.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title={collapsed ? active.name : undefined}
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
        <WsAvatar initials={active.initials} color={active.avatarColor} />
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate text-left text-[13.5px] font-medium text-fg">
              {active.name}
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
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className={`absolute z-[100] min-w-[260px] overflow-hidden rounded-xl border border-subtle bg-dark-card shadow-popover ${
              collapsed
                ? "left-full top-0 ml-2 origin-top-left"
                : "left-0 top-full mt-1 origin-top-left"
            }`}
          >
            {/* Workspaces */}
            <div className="flex flex-col gap-px p-1.5">
              <p className="px-2 pt-1.5 pb-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.06em] text-fg-faint">
                Workspaces
              </p>
              {WORKSPACES.map((ws) => (
                <button
                  key={ws.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setActiveId(ws.id);
                    setOpen(false);
                  }}
                  className={`flex items-center gap-2.5 rounded-[4px] px-2 py-1.5 text-left transition-colors ${
                    ws.id === activeId
                      ? "bg-hover"
                      : "hover:bg-hover"
                  }`}
                >
                  <WsAvatar
                    initials={ws.initials}
                    color={ws.avatarColor}
                  />
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate text-[13px] font-medium text-fg">
                      {ws.name}
                    </span>
                    <span className="mt-px truncate text-[11px] text-fg-faint">
                      {ws.sub}
                    </span>
                  </span>
                  {ws.id === activeId && (
                    <Check
                      className="h-3.5 w-3.5 shrink-0 text-green-bright"
                      aria-hidden="true"
                    />
                  )}
                </button>
              ))}
              <button
                type="button"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="mt-px flex items-center gap-2.5 rounded-[4px] px-2 py-1.5 text-[13px] text-fg-strong transition-colors hover:bg-hover hover:text-fg"
              >
                <Plus className="h-3.5 w-3.5 text-fg-faint" aria-hidden="true" />
                <span>Create workspace</span>
              </button>
            </div>

            <div className="h-px bg-hairline" />

            {/* Workspace-scoped actions */}
            <div className="flex flex-col gap-px p-1.5">
              <Link
                href="/dashboard/settings"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-[4px] px-2 py-1.5 text-[13px] text-fg-strong transition-colors hover:bg-hover hover:text-fg"
              >
                <Settings
                  className="h-3.5 w-3.5 text-fg-faint"
                  aria-hidden="true"
                />
                Workspace settings
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-[4px] px-2 py-1.5 text-left text-[13px] text-fg-strong transition-colors hover:bg-hover hover:text-fg"
              >
                <UserPlus
                  className="h-3.5 w-3.5 text-fg-faint"
                  aria-hidden="true"
                />
                Invite members
              </button>
              <Link
                href="/dashboard/settings?tab=billing"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-[4px] px-2 py-1.5 text-[13px] text-fg-strong transition-colors hover:bg-hover hover:text-fg"
              >
                <CreditCard
                  className="h-3.5 w-3.5 text-fg-faint"
                  aria-hidden="true"
                />
                Billing
              </Link>
            </div>

            <div className="h-px bg-hairline" />

            {/* Account */}
            <div className="flex flex-col gap-px p-1.5">
              <div className="px-2 pt-1 pb-1.5 leading-tight">
                <p className="truncate text-[12px] font-medium text-fg-strong">
                  {user.name}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-fg-faint">
                  {user.email}
                </p>
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
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
