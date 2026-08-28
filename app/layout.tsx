import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "https://dashboard.livepeer.org"
  ),
  title: "Livepeer Console",
  description:
    "Browse AI apps, manage API keys, and monitor usage on the Livepeer network.",
};

// FOUT prevention — runs synchronously before paint so dual-source CSS
// variables resolve to the stored theme on first render. With no stored
// preference we fall back to "system", i.e. the OS `prefers-color-scheme`.
// ThemeProvider in the (app) layout takes over after hydration.
const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('theme')||'system';var d=s==='dark'||(s!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){document.documentElement.dataset.theme='dark';}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={GeistMono.variable}>
      <head>
        {/* Inter, self-hosted from the author's distribution — see the
            generated @font-face rules in app/fonts.css (scripts/build-inter-fonts.py).
            Preloaded because it's on the critical render path for every page;
            `crossorigin` is required even same-origin, as fonts are always
            fetched in CORS mode. Only the latin subset is preloaded — the
            full-coverage fallback is demand-loaded. */}
        <link
          rel="preload"
          href="/fonts/InterVariable-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
