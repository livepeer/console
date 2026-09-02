// Primary nav for the console sidebar. During the creator pilot (Sep 2026)
// this is deliberately three destinations:
//
//   - "home"         → Home — MCP install instructions and harness connection
//                      state. The only onboarding surface.
//   - "organization" → Usage (spend, plus the calls log folded in underneath)
//                      and Settings.
//
// Two zones are defined but not rendered in the signed-in rail:
//   - "network"      → Explore and Stats. Still real routes, still linkable,
//                      and still the signed-out landing — they just aren't
//                      console destinations. Filtered out in ConsoleSidebar.
//
// Removed for the pilot (see the Sep 1 2026 sync with Peace):
//   - API keys — auth happens over OAuth when a harness adds the MCP
//     connector, so there is no key to provision. `/keys` still exists but is
//     unreachable from the nav; bring the entry back with the route when
//     developer-issued keys return.
//   - Calls — the per-request log now renders underneath Spend by capability
//     on /usage rather than as its own destination.
//
// Settings carries a chev-right (rendered by NavLink via `submenu: true`)
// instead of a count, signaling that it leads into a sub-experience.
export const PORTAL_NAV_ITEMS = [
  {
    label: "Home",
    href: "/home",
    icon: "House" as const,
    kbd: "G H",
    zone: "home" as const,
  },
  {
    label: "Explore",
    href: "/explore",
    icon: "LayoutGrid" as const,
    zone: "network" as const,
  },
  {
    label: "Stats",
    href: "/network",
    icon: "Globe" as const,
    zone: "network" as const,
  },
  {
    label: "Usage",
    href: "/usage",
    icon: "BarChart3" as const,
    zone: "organization" as const,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: "Settings" as const,
    submenu: true,
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
export const MCP_SERVER_URL = "https://agent.livepeer.org/api/mcp";
