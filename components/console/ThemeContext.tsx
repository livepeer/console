"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

/**
 * Theme preference values.
 *  - "light"  / "dark": explicit user choice, ignores OS
 *  - "system": follow `prefers-color-scheme` and re-resolve when it changes
 */
export type ThemePreference = "light" | "dark" | "system";

/** What's actually applied to `<html data-theme="...">`. Always concrete. */
export type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  /** The console is system-only; this always reports "system". */
  preference: ThemePreference;
  /** The concrete theme currently applied (resolved through `system`). */
  resolved: ResolvedTheme;
  /** True until the first OS theme read has completed on the client. */
  isLoading: boolean;
  /** Kept for API compatibility; resets back to system. */
  setPreference: (p: ThemePreference) => void;
}

const THEME_STORAGE_KEY = "theme";

const ThemeContext = createContext<ThemeContextValue>({
  preference: "system",
  resolved: "dark",
  isLoading: true,
  setPreference: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

/** Read media query result with a SSR-safe fallback. */
function prefersDarkOS(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Resolve the live OS preference to a concrete theme. */
function resolveSystemPreference(): ResolvedTheme {
  return prefersDarkOS() ? "dark" : "light";
}

/**
 * ThemeProvider — keeps the console on the system theme.
 *
 * The `<html data-theme="...">` attribute is set both by an inline script in
 * the console layout (`app/(app)/layout.tsx` — runs before
 * paint, prevents FOUT) and by this provider (keeps the attribute in sync
 * after hydration).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [resolved, setResolved] = useState<ResolvedTheme>("dark");
  const [isLoading, setIsLoading] = useState(true);

  // Apply `data-theme` to <html> whenever resolved changes. The inline script
  // in the layout sets it for the first paint; this keeps it in sync after
  // any state change (user picks a theme, OS pref flips while in "system").
  const applyResolved = useCallback((next: ResolvedTheme) => {
    setResolved(next);
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = next;
    }
  }, []);

  // Hydration: ignore old stored light/dark values and resolve from the OS.
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } catch {
      // localStorage may throw in iframes / private mode.
    }

    applyResolved(resolveSystemPreference());
    setIsLoading(false);

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyResolved(resolveSystemPreference());
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [applyResolved]);

  const setPreference: ThemeContextValue["setPreference"] = useCallback(
    () => {
      try {
        window.localStorage.removeItem(THEME_STORAGE_KEY);
      } catch {
        // ignore
      }
      applyResolved(resolveSystemPreference());
    },
    [applyResolved]
  );

  return (
    <ThemeContext.Provider
      value={{ preference: "system", resolved, isLoading, setPreference }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
