import { AgentScrollerPage } from "@/components/livepeer-ui/agent-scroller-page";
import {
  capabilities,
  networkImages,
} from "@/components/livepeer-ui/frozen-content";
import { WaitlistSessionProvider } from "@/components/livepeer-ui/waitlist-session";
import { getCurrentWaitlistSession } from "@/lib/waitlist/current-session";
import { buildWaitlistJoinHref } from "@/components/livepeer-ui/waitlist-auth-navigation";

export default async function WaitlistPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") params.set(key, value);
  }
  const initialSession = await getCurrentWaitlistSession();

  return (
    <WaitlistSessionProvider
      initialSession={initialSession}
      initialJoinHref={buildWaitlistJoinHref(params)}
    >
      <AgentScrollerPage
        capabilities={capabilities}
        networkImages={networkImages}
      />
    </WaitlistSessionProvider>
  );
}
