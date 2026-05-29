"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Dialog from "@/components/design-system/Dialog";

/**
 * KeyboardShortcuts — global `?` overlay + Linear-style `G+letter` nav.
 *
 * Per the Livepeer Dashboard design (Claude Design handoff, Apr 2026): pressing
 * `?` anywhere outside an input opens a discovery overlay listing every working
 * shortcut, grouped Global / Navigation. The overlay reuses the same Dialog
 * chrome as the Cmd-K palette so the two surfaces feel like one vocabulary.
 *
 * `G` followed within ~700ms by `H | E | U | K | S` jumps to the matching route.
 * Both handlers ignore inputs / textareas / contentEditable so typing in the
 * playground doesn't accidentally navigate.
 */

interface Group {
  title: string;
  items: { keys: (string | "–")[]; label: string }[];
}

const GROUPS: Group[] = [
  {
    title: "Global",
    items: [
      { keys: ["⌘", "K"], label: "Open command palette" },
      { keys: ["?"], label: "Show this overlay" },
      { keys: ["esc"], label: "Close dialogs / overlays" },
    ],
  },
  {
    title: "Navigation",
    items: [
      { keys: ["G", "H"], label: "Go to Home" },
      { keys: ["G", "E"], label: "Go to Explore" },
      { keys: ["G", "J"], label: "Go to Jobs" },
      { keys: ["G", "U"], label: "Go to Usage" },
      { keys: ["G", "K"], label: "Go to API keys" },
      { keys: ["G", "S"], label: "Go to Settings" },
    ],
  },
];

const NAV_TARGETS: Record<string, string> = {
  h: "/home",
  e: "/",
  j: "/jobs",
  u: "/usage",
  k: "/keys",
  s: "/settings",
};

function isFieldElement(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

export default function KeyboardShortcuts() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    let gExpiresAt = 0;

    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isFieldElement(e.target)) return;

      // `?` toggles the overlay
      if (e.key === "?") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }

      // Don't intercept other keys while the overlay is open
      if (open) return;

      const now = Date.now();
      const key = e.key.toLowerCase();

      // First press: arm `G` prefix
      if (key === "g" && now > gExpiresAt) {
        gExpiresAt = now + 700;
        return;
      }

      // Second press within window: route to target
      if (now <= gExpiresAt && NAV_TARGETS[key]) {
        e.preventDefault();
        gExpiresAt = 0;
        router.push(NAV_TARGETS[key]);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, router]);

  return (
    <Dialog open={open} onClose={close} maxWidth="max-w-[560px]">
      {/* Header — matches Cmd-K chrome */}
      <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
        <span className="text-[13px] font-medium text-fg-strong tracking-[-0.005em]">
          Keyboard shortcuts
        </span>
        <button
          type="button"
          onClick={close}
          aria-label="Close shortcuts"
          className="shrink-0 rounded-md border border-subtle bg-tint px-2.5 py-1 text-[11px] text-fg-muted transition-colors hover:border-strong hover:bg-pop hover:text-fg"
        >
          ESC
        </button>
      </div>

      {/* Body — grouped shortcut rows */}
      <div className="max-h-[60vh] overflow-y-auto px-2 py-2">
        {GROUPS.map((group, gi) => (
          <div
            key={group.title}
            className={`px-2.5 pb-2.5 ${gi > 0 ? "mt-1 border-t border-hairline pt-2" : ""}`}
          >
            <p className="px-1 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-fg-disabled">
              {group.title}
            </p>
            <div className="flex flex-col">
              {group.items.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-4 px-1 py-[7px]"
                >
                  <span className="text-[13px] text-fg-strong">
                    {item.label}
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1">
                    {item.keys.map((k, j) =>
                      k === "–" ? (
                        <span
                          key={j}
                          className="px-0.5 font-mono text-[11px] text-fg-disabled"
                        >
                          –
                        </span>
                      ) : (
                        <kbd
                          key={j}
                          className="rounded border border-subtle bg-tint px-1.5 py-0.5 font-mono text-[10.5px] text-fg-muted"
                        >
                          {k}
                        </kbd>
                      ),
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 border-t border-hairline bg-zebra px-4 py-2 font-mono text-[11px] text-fg-faint">
        <span>
          Press{" "}
          <kbd className="rounded border border-subtle bg-tint px-1.5 py-0.5 text-[10.5px] text-fg-muted">
            ?
          </kbd>{" "}
          any time
        </span>
        <span className="ml-auto text-fg-disabled">
          Livepeer · Flipbook workspace
        </span>
      </div>
    </Dialog>
  );
}
