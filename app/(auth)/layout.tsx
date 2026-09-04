import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Livepeer Early Access",
  description: "Sign in or create an account to access Livepeer Early Access.",
};

export default function ConsoleAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen overflow-x-clip overscroll-none bg-background font-sans">
      {children}
    </div>
  );
}
