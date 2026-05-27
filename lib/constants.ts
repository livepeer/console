// Primary nav for the dashboard sidebar:
//   Home (G H) → Explore (47) → Jobs (1.2K) → Usage → API keys (3) → Settings ›
// Settings carries a chev-right (rendered by NavLink via `submenu: true`)
// instead of a count, signaling that it leads into a sub-experience.
export const PORTAL_NAV_ITEMS = [
  { label: "Home", href: "/home", icon: "House" as const, kbd: "G H" },
  { label: "Explore", href: "/", icon: "LayoutGrid" as const },
  { label: "Jobs", href: "/jobs", icon: "Activity" as const },
  { label: "Usage", href: "/usage", icon: "BarChart3" as const },
  { label: "API keys", href: "/keys", icon: "Key" as const },
  {
    label: "Settings",
    href: "/settings",
    icon: "Settings" as const,
    submenu: true,
  },
] as const;

export const EXTERNAL_LINKS = {
  docs: "https://docs.livepeer.org",
  discord: "https://discord.gg/livepeer",
  github: "https://github.com/livepeer",
} as const;
