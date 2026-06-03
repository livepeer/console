// Primary nav for the dashboard sidebar, grouped into three tiers by scope:
//   - "home"        → Home (the ungrouped dashboard root)
//   - "network"     → Explore (the global capability catalog you *consume*) and
//                     Stats (network-wide orchestrator/GPU/payment health).
//                     Network-wide, not environment-scoped.
//   - "environment" → Apps / Jobs / API keys (your own deployed + operated
//                     resources, scoped to the active environment). The
//                     environment switcher heads this group. API keys here are
//                     the *call* credential (env-scoped, Stripe-style).
//   - "organization"   → Usage, Calls, and Settings (members, billing, plan,
//                     profile, deploy tokens) — env-agnostic. Usage is one
//                     free-tier pool / one bill across all environments
//                     (matching Modal's organization-level "Usage & Billing"),
//                     so it sits OUTSIDE the environment switcher's scope.
//                     Calls is the per-request log behind Usage — every call
//                     this workspace made (batch + live).
// Settings carries a chev-right (rendered by NavLink via `submenu: true`)
// instead of a count, signaling that it leads into a sub-experience.
export const PORTAL_NAV_ITEMS = [
  { label: "Home", href: "/home", icon: "House" as const, kbd: "G H", zone: "home" as const },
  { label: "Explore", href: "/", icon: "LayoutGrid" as const, zone: "network" as const },
  { label: "Stats", href: "/network", icon: "Globe" as const, zone: "network" as const },
  { label: "Apps", href: "/apps", icon: "Box" as const, zone: "environment" as const },
  { label: "API keys", href: "/keys", icon: "Key" as const, zone: "environment" as const },
  { label: "Usage", href: "/usage", icon: "BarChart3" as const, zone: "organization" as const },
  { label: "Calls", href: "/calls", icon: "Activity" as const, zone: "organization" as const },
  {
    label: "Settings",
    href: "/settings",
    icon: "Settings" as const,
    submenu: true,
    zone: "organization" as const,
  },
] as const;

export const EXTERNAL_LINKS = {
  docs: "https://docs.livepeer.org",
  discord: "https://discord.gg/livepeer",
  github: "https://github.com/livepeer",
} as const;
