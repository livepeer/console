import type { Metadata } from "next";
import { AuthProvider } from "@/components/console/AuthContext";

export const metadata: Metadata = {
  title: "Sign in — Livepeer Early Access",
  description: "Sign in or create an account to access Livepeer Early Access.",
};

export default function ConsoleAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="min-h-screen overflow-x-clip overscroll-none bg-dark font-sans">
        {children}
      </div>
    </AuthProvider>
  );
}
