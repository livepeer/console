import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { AuthProvider } from "@/components/dashboard/AuthContext";

export const metadata: Metadata = {
  title: "Sign in — Livepeer Developer Dashboard",
  description:
    "Sign in or create an account to access the Livepeer Developer Dashboard.",
};

// Auth pages share the dashboard's Geist typography rather than the marketing
// site's Favorit Pro — the "you've crossed into the tool" cliff starts here.
const geistOverride = {
  "--font-sans": "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
  "--font-mono": "var(--font-geist-mono), ui-monospace, monospace",
} as CSSProperties;

export default function DashboardAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div
        className={`min-h-screen bg-dark font-sans ${GeistSans.variable} ${GeistMono.variable}`}
        style={geistOverride}
      >
        {children}
      </div>
    </AuthProvider>
  );
}
