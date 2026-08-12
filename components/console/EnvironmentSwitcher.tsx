"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Environment, EnvironmentKind } from "@/lib/console/types";
import { useEnvironment } from "@/components/console/EnvironmentContext";

// Production = green (primary), development / sandboxes = blue (cold/secondary),
// per the console color rules. `warm` is reserved for liveness and is never
// used here.
function dotColor(kind: EnvironmentKind): string {
  return kind === "production"
    ? "var(--color-green-bright)"
    : "var(--color-blue-bright)";
}

const dropdownVariants = {
  hidden: { opacity: 0, scale: 0.95, y: -4 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: -4 },
};

function EnvDot({ kind, size = 7 }: { kind: EnvironmentKind; size?: number }) {
  return (
    <span
      className="shrink-0 rounded-full"
      style={{ width: size, height: size, background: dotColor(kind) }}
      aria-hidden="true"
    />
  );
}

/**
 * EnvironmentSwitcher — sidebar environment selector.
 *
 * Sits directly under the organization switcher, forming the `organization /
 * environment` coordinate Modal puts in its top bar. The leading slash is the
 * visual cue that this is a child of the organization above it. Selecting an
 * environment scopes API keys, jobs, and usage across the console.
 *
 * Mock-only — environments and selection are session-local (see
 * EnvironmentContext).
 */
export default function EnvironmentSwitcher({
  collapsed,
}: {
  collapsed: boolean;
}) {
  const {
    environments,
    selectedEnvironment,
    setEnvironment,
    createEnvironment,
  } = useEnvironment();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Reset the create affordance whenever the menu closes.
  useEffect(() => {
    if (!open) {
      setCreating(false);
      setDraft("");
    }
  }, [open]);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  const commitCreate = () => {
    const name = draft.trim();
    if (!name) return;
    createEnvironment(name);
    setOpen(false);
  };

  const pick = (env: Environment) => {
    setEnvironment(env.id);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={`Environment: ${selectedEnvironment.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title={collapsed ? selectedEnvironment.name : undefined}
        className={
          collapsed
            ? `mx-auto flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                open ? "bg-tint" : "hover:bg-hover"
              }`
            : `flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors ${
                open ? "bg-tint" : "hover:bg-hover"
              }`
        }
      >
        {collapsed ? (
          <EnvDot kind={selectedEnvironment.kind} />
        ) : (
          <>
            <EnvDot kind={selectedEnvironment.kind} />
            <span className="min-w-0 flex-1 truncate text-left text-[12.5px] font-medium text-fg-strong">
              {selectedEnvironment.name}
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
            className={`absolute z-[100] min-w-[240px] overflow-hidden rounded-xl border border-subtle bg-dark-card shadow-popover ${
              collapsed
                ? "left-full top-0 ml-2 origin-top-left"
                : "left-0 top-full mt-1 origin-top-left"
            }`}
          >
            <div className="flex flex-col gap-px p-1.5">
              <p className="px-2 pt-1.5 pb-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.06em] text-fg-faint">
                Environments
              </p>
              {environments.map((env) => (
                <button
                  key={env.id}
                  type="button"
                  role="menuitem"
                  onClick={() => pick(env)}
                  className={`flex items-center gap-2.5 rounded-[4px] px-2 py-1.5 text-left transition-colors ${
                    env.id === selectedEnvironment.id
                      ? "bg-hover"
                      : "hover:bg-hover"
                  }`}
                >
                  <EnvDot kind={env.kind} />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg">
                    {env.name}
                  </span>
                  {env.id === selectedEnvironment.id && (
                    <Check
                      className="h-3.5 w-3.5 shrink-0 text-green-bright"
                      aria-hidden="true"
                    />
                  )}
                </button>
              ))}

              {creating ? (
                <div className="mt-px px-2 py-1.5">
                  <input
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitCreate();
                      if (e.key === "Escape") {
                        e.stopPropagation();
                        setCreating(false);
                      }
                    }}
                    placeholder="staging"
                    className="w-full rounded-[4px] border border-hairline bg-dark px-2 py-1 text-[12.5px] text-fg-strong outline-none placeholder:text-fg-faint focus-visible:ring-1 focus-visible:ring-green-bright/30"
                  />
                  <div className="mt-1.5 flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCreating(false)}
                      className="rounded-[4px] px-2 py-1 text-[12px] text-fg-faint transition-colors hover:bg-hover hover:text-fg"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={commitCreate}
                      disabled={!draft.trim()}
                      className="btn-primary rounded-[4px] px-2 py-1 text-[12px] font-medium transition-colors disabled:opacity-50"
                    >
                      Create
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setCreating(true)}
                  className="mt-px flex items-center gap-2.5 rounded-[4px] px-2 py-1.5 text-[13px] text-fg-strong transition-colors hover:bg-hover hover:text-fg"
                >
                  <Plus
                    className="h-3.5 w-3.5 text-fg-faint"
                    aria-hidden="true"
                  />
                  <span>Create environment</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
