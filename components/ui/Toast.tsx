"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, AlertCircle, Info, X } from "lucide-react";

type ToastTone = "success" | "error" | "info";

interface ToastEntry {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
  /** Auto-dismiss delay in ms. Default 4000. Pass 0 to require manual dismiss. */
  durationMs?: number;
}

interface ToastContextValue {
  push: (toast: Omit<ToastEntry, "id">) => number;
  dismiss: (id: number) => void;
  success: (title: string, description?: string) => number;
  error: (title: string, description?: string) => number;
  info: (title: string, description?: string) => number;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLES: Record<
  ToastTone,
  { icon: typeof Check; color: string; bg: string; border: string }
> = {
  success: {
    icon: Check,
    color: "text-green-bright",
    bg: "bg-green-bright/10",
    border: "border-green-bright/25",
  },
  error: {
    icon: AlertCircle,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-400/30",
  },
  info: {
    icon: Info,
    color: "text-blue-bright",
    bg: "bg-blue-bright/10",
    border: "border-blue-bright/25",
  },
};

/**
 * ToastProvider — wrap the dashboard tree to enable `useToast()`.
 *
 * Stacks toasts bottom-right with auto-dismiss. Each toast has a tone (success
 * / error / info), a title, and an optional description. Manual dismiss via
 * the X button on the toast.
 *
 * Convenience methods:
 *   const toast = useToast();
 *   toast.success("Key copied");
 *   toast.error("Save failed", "Try again or check your connection.");
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (toast: Omit<ToastEntry, "id">) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, durationMs: 4000, ...toast }]);
      return id;
    },
    [],
  );

  // Auto-dismiss timer per toast
  useEffect(() => {
    const timers = toasts
      .filter((t) => (t.durationMs ?? 0) > 0)
      .map((t) =>
        window.setTimeout(() => dismiss(t.id), t.durationMs as number),
      );
    return () => {
      for (const id of timers) window.clearTimeout(id);
    };
  }, [toasts, dismiss]);

  const value: ToastContextValue = {
    push,
    dismiss,
    success: (title, description) => push({ tone: "success", title, description }),
    error: (title, description) => push({ tone: "error", title, description }),
    info: (title, description) => push({ tone: "info", title, description }),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <div
            className="pointer-events-none fixed bottom-4 right-4 z-[200] flex flex-col gap-2"
            aria-live="polite"
            aria-label="Notifications"
          >
            <AnimatePresence>
              {toasts.map((t) => {
                const { icon: Icon, color, bg, border } = TONE_STYLES[t.tone];
                return (
                  <motion.div
                    key={t.id}
                    layout
                    initial={{ opacity: 0, y: 16, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 16, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    role="status"
                    className={`pointer-events-auto flex w-80 max-w-[calc(100vw-2rem)] items-start gap-3 rounded-xl border ${border} bg-dark-card/95 p-3.5 pr-2 shadow-xl shadow-black/40 backdrop-blur-md`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${bg} ${color}`}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="text-sm font-medium text-white">{t.title}</p>
                      {t.description && (
                        <p className="mt-0.5 text-xs text-fg-faint">
                          {t.description}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => dismiss(t.id)}
                      aria-label="Dismiss notification"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-fg-faint transition-colors hover:bg-white/[0.06] hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

/**
 * useToast — read the toast context. Throws if `<ToastProvider>` is missing
 * higher in the tree (which would silently swallow the call otherwise).
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error(
      "useToast must be called inside a <ToastProvider> tree. Wrap the dashboard layout with <ToastProvider>.",
    );
  }
  return ctx;
}
