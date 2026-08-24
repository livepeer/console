import type { Metadata } from "next";
import { AuthProvider } from "@/components/console/AuthContext";

export const metadata: Metadata = {
  title: "Sign in — Livepeer Console",
  description: "Sign in or create an account to access the Livepeer Console.",
};

// Auth pages share the console's typography (Inter / Geist Mono, set in the
// root layout) rather than the marketing site's Favorit Pro — the "you've
// crossed into the tool" cliff starts here.
export default function ConsoleAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-dark font-sans">{children}</div>
    </AuthProvider>
  );
}
