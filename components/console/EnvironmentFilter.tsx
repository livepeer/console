"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useEnvironment } from "@/components/console/EnvironmentContext";

/**
 * EnvironmentFilter — a lightweight, page-local environment narrower.
 *
 * This replaces the old *global* environment switcher. The product reality is
 * that most organizations have just two environments (Production + Development)
 * and large parts of the console aren't env-scoped at all — so a persistent
 * global "mode" was heavy machinery that kept implying scope it didn't have.
 *
 * Instead, env-scoped resources (Apps, Runs, API keys) default to **All
 * environments** with env shown as a per-row facet, and this filter lets you
 * narrow to one when you want to. It's the page's scope indicator too, so a
 * page using it needs no separate scope chip.
 */

export const ALL_ENVIRONMENTS = "all";

function dotColor(kind: string | null): string | null {
  if (kind === "production") return "var(--color-green-bright)";
  if (kind) return "var(--color-blue-bright)";
  return null;
}

export default function EnvironmentFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { environments } = useEnvironment();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const options: { id: string; name: string; kind: string | null }[] = [
    { id: ALL_ENVIRONMENTS, name: "All environments", kind: null },
    ...environments.map((e) => ({ id: e.id, name: e.name, kind: e.kind })),
  ];
  const current = options.find((o) => o.id === value) ?? options[0];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-[26px] items-center gap-1.5 rounded-[4px] border border-transparent px-2.5 text-[12.5px] text-fg-strong transition-colors hover:border-hairline hover:bg-hover hover:text-fg"
      >
        <span className="text-fg-faint">Environment</span>
        {dotColor(current.kind) && (
          <span
            className="h-[5px] w-[5px] rounded-full"
            style={{ background: dotColor(current.kind)! }}
            aria-hidden="true"
          />
        )}
        <span>{current.name}</span>
        <ChevronDown className="h-3 w-3" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 min-w-[200px] overflow-hidden rounded-md border border-subtle bg-dark-card p-1 shadow-popover"
        >
          {options.map((o) => {
            const c = dotColor(o.kind);
            return (
              <button
                key={o.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-[4px] px-2 py-1.5 text-left text-[12.5px] transition-colors ${
                  o.id === value
                    ? "bg-hover text-fg"
                    : "text-fg-strong hover:bg-hover hover:text-fg"
                }`}
              >
                <span
                  className="h-[5px] w-[5px] shrink-0 rounded-full"
                  style={c ? { background: c } : undefined}
                  aria-hidden="true"
                />
                <span className="flex-1">{o.name}</span>
                {o.id === value && (
                  <Check
                    className="h-3.5 w-3.5 shrink-0 text-green-bright"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
