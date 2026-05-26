"use client";

// Next.js App Router error boundary for the entire (dashboard) segment.
// Catches render errors from any /dashboard/* route and surfaces a recoverable
// ErrorState with a retry affordance + request ID instead of a blank panel.

import { useEffect } from "react";
import ErrorState from "@/components/ui/ErrorState";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to console for now. When real telemetry lands, route to it here.
    console.error("[dashboard] render error:", error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col bg-dark">
      <div className="mx-auto w-full max-w-3xl px-5 pt-10 pb-16 lg:px-8">
        <ErrorState
          title="This page hit an error"
          description="The dashboard view crashed while rendering. Try again, or include the request ID below if you reach out for help."
          requestId={error.digest}
          onRetry={reset}
        />
      </div>
    </main>
  );
}
