import ExploreView from "@/components/dashboard/ExploreView";

// /explore — the app catalog as a first-class destination (the sidebar's
// "Explore" item points here). Reachable signed-in or out; unlike `/`, it never
// redirects, so logged-in users can browse without bouncing to Home.
export default function ExplorePage() {
  return <ExploreView />;
}
