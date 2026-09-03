// Primary nav for the console sidebar. During the creator pilot (Sep 2026)
// this is deliberately three destinations:
//
//   - "organization" → Home (balance and the calls log).
//
// One zone is defined but not rendered in the signed-in rail:
//   - "network"      → Explore and Stats. Still real routes, still linkable,
//                      and still the signed-out landing — they just aren't
//                      console destinations. Filtered out in ConsoleSidebar.
//
// Removed for the pilot (see the Sep 1 2026 sync with Peace):
//   - API keys — auth happens over OAuth when a harness adds the MCP
//     connector, so there is no key to provision. `/keys` still exists but is
//     unreachable from the nav; bring the entry back with the route when
//     developer-issued keys return.
//   - Calls — the per-request log now renders on /home rather than as its own
//     destination.
//
export const PORTAL_NAV_ITEMS = [
  {
    label: "Explore",
    href: "/explore",
    zone: "network" as const,
  },
  {
    label: "Stats",
    href: "/network",
    zone: "network" as const,
  },
  {
    label: "Home",
    href: "/home",
    zone: "organization" as const,
  },
] as const;

export const EXTERNAL_LINKS = {
  site: "https://livepeer.org",
  docs: "https://docs.livepeer.org",
  discord: "https://discord.gg/55SZFEEH5y",
  github: "https://github.com/livepeer",
} as const;

/**
 * The MCP endpoint a harness connects to. Adding it kicks off an OAuth
 * round-trip back to this console, which is why the pilot ships no API keys.
 */
export const MCP_SERVER_URL = "https://earlyaccess.livepeer.org/api/mcp";
