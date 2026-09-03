"use client";

import { Suspense } from "react";
import { useAuth } from "@/components/console/AuthContext";
import ConsolePageSkeleton from "@/components/console/ConsolePageSkeleton";
import SignInWall from "@/components/console/SignInWall";
import UsageView from "@/components/console/UsageView";

export default function HomePage() {
  return (
    <Suspense fallback={<ConsolePageSkeleton kpiCount={4} withChart />}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const { isConnected, isLoading } = useAuth();

  // Avoid flashing the wall while auth hydrates.
  if (isLoading) return null;

  // Organization-only route — logged-out users see the in-shell sign-in wall
  // instead of a hard redirect.
  if (!isConnected) return <SignInWall route="home" />;

  return (
    <main id="main-content" className="flex flex-1 flex-col bg-dark">
      <div className="flex flex-1 flex-col">
        <UsageView />
      </div>
    </main>
  );
}
