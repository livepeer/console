import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { AuthProvider } from "@/components/dashboard/AuthContext";
import { EnvironmentProvider } from "@/components/dashboard/EnvironmentContext";
import { ThemeProvider } from "@/components/dashboard/ThemeContext";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import KeyboardShortcuts from "@/components/dashboard/KeyboardShortcuts";

// FOUT prevention — runs synchronously in the document, before the dashboard
// subtree paints. Reads the stored theme preference from localStorage and
// applies `<html data-theme="...">` so dual-source CSS variables resolve to
// the right theme on first paint. The ThemeProvider takes over after
// hydration; this is just the bootstrap.
//
// Reads the same `localStorage["theme"]` key the marketing site uses (see
// `app/layout.tsx`'s inline script and `components/layout/ThemeToggle.tsx`),
// so flipping the theme on either surface propagates to the other. Default
// is "system" for first-time visitors — we follow the OS `prefers-color-scheme`
// until the user pins light or dark via Settings → Appearance.
const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('theme')||'system';var d=s==='dark'||(s!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){document.documentElement.dataset.theme='dark';}})();`;

export const metadata: Metadata = {
  title: "Developer Dashboard — Livepeer",
  description:
    "Browse AI apps, manage API keys, and monitor usage on the Livepeer network.",
};

// Dashboard runs on Geist (Vercel's open-source font) instead of Favorit Pro —
// the dashboard is a *tool*, the marketing site is the brand. We attach the Geist
// CSS variables to this subtree and override `--font-sans` / `--font-mono` so
// every Tailwind `font-sans` / `font-mono` consumer below this point picks Geist.
//
// Density: per the Livepeer Console design (Claude Design handoff, Apr 2026),
// the dashboard subtree uses a 13.5px body with a slightly tighter letter-spacing
// to land in the same density bracket as Linear. Sidebar width and chrome head
// height are exposed as custom properties so components can reference them.
const dashboardOverrides = {
  "--font-sans": "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
  "--font-mono": "var(--font-geist-mono), ui-monospace, monospace",
  "--side-w": "232px",
  "--head-h": "44px",
  fontSize: "13.5px",
  letterSpacing: "-0.005em",
} as CSSProperties;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Flush full-bleed shell — no rounded floating panel. Sidebar sits flush
  // against the left edge with a hairline border on the right; main content
  // fills the remaining width.
  return (
    <>
      {/* Inline theme bootstrap — must run before the dashboard subtree
          paints. ThemeProvider below takes over post-hydration. */}
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      <ThemeProvider>
        <AuthProvider>
          <EnvironmentProvider>
            <div
              className={`flex min-h-screen flex-col bg-dark font-sans md:h-screen md:min-h-0 md:flex-row md:overflow-hidden ${GeistSans.variable} ${GeistMono.variable}`}
              style={dashboardOverrides}
            >
              <DashboardSidebar />
              <div className="flex min-w-0 flex-1 flex-col bg-dark border-l border-hairline md:overflow-y-auto">
                {children}
              </div>
              <KeyboardShortcuts />
            </div>
          </EnvironmentProvider>
        </AuthProvider>
      </ThemeProvider>
    </>
  );
}
