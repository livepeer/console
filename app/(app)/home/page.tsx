"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { House } from "lucide-react";
import { useAuth } from "@/components/console/AuthContext";
import ConsolePageHeader from "@/components/console/ConsolePageHeader";
import HomeCommandBar from "@/components/console/HomeCommandBar";
import McpConnectPanel from "@/components/console/McpConnectPanel";

function HomePageHeader() {
  return <ConsolePageHeader title="Home" icon={House} />;
}

// ─── Home Page ───
//
// One job: get the MCP endpoint into the user's agent.
//
// Home used to be an operations dashboard — a first-run checklist, a spend
// panel and a recent-activity preview. All three came out for the creator
// pilot:
//
//   • the checklist walked through provisioning an API key, and the pilot
//     provisions none — connecting a harness is the whole of onboarding now
//   • the spend panel and activity preview restated /usage, which is one
//     click away in the rail and carries the real versions
//
// What's left is deliberately sparse. A creator arriving here should be a
// couple of copies away from having Livepeer inside their agent, and the page
// should read as early — because it is.
//
// The running balance is not repeated here: it sits in the sidebar card, which
// is on screen for every route rather than only this one.

export default function HomePage() {
  const { isConnected, isLoading, user } = useAuth();
  const router = useRouter();

  // Middleware already sends signed-out requests to /login before this page
  // is served (see middleware.ts). This client-side fallback only fires if
  // the session lapses while the console is open.
  useEffect(() => {
    if (!isLoading && (!isConnected || !user)) {
      router.replace("/login");
    }
  }, [isLoading, isConnected, user, router]);

  if (isLoading) return null;

  // Redirect is in flight; render nothing while it takes effect.
  if (!isConnected || !user) return null;

  const firstName = user.name.split(" ")[0] || "there";

  return (
    <main id="main-content" className="relative flex flex-1 flex-col bg-dark">
      {/* Atmosphere — a faint brand-green aura bleeding from the top edge, so
          the console reads as a lit panel rather than a flat page. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72"
        style={{
          background:
            "radial-gradient(70% 100% at 50% 0%, color-mix(in oklab, var(--color-green-bright) 7%, transparent) 0%, transparent 72%)",
        }}
        aria-hidden="true"
      />

      <HomePageHeader />
      <div className="relative flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-7 pb-20 pt-8">
          <div className="home-rise">
            <HomeCommandBar firstName={firstName} />
            <p className="mt-2.5 max-w-xl text-[13.5px] leading-[1.55] text-fg-muted">
              Livepeer Agent runs as an MCP server your agent runtime calls
              directly. Connect one below and every capability on the network —
              video, image, audio, 3D — becomes something you can just ask for.
            </p>
          </div>

          <div className="home-rise mt-7" style={{ animationDelay: "60ms" }}>
            <McpConnectPanel />
          </div>
        </div>
      </div>
    </main>
  );
}
