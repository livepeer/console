export type NavChild = {
  label: string;
  href: string;
  external?: boolean;
};

export type NavItem = {
  label: string;
  href: string;
  children?: NavChild[];
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/" },
  {
    label: "Network",
    href: "https://explorer.livepeer.org",
    children: [
      { label: "Ecosystem", href: "/ecosystem" },
      { label: "Livepeer Token", href: "/token" },
      {
        label: "Delegate LPT",
        href: "https://explorer.livepeer.org",
        external: true,
      },
      {
        label: "Provide GPUs",
        href: "https://docs.livepeer.org/v1/orchestrators/guides/get-started",
        external: true,
      },
      {
        label: "Roadmap",
        href: "https://roadmap.livepeer.org/roadmap",
        external: true,
      },
    ],
  },
  {
    label: "Resources",
    href: "/foundation",
    children: [
      { label: "Primer", href: "/primer" },
      { label: "Blog", href: "/blog" },
      { label: "Foundation", href: "/foundation" },
      { label: "Brand", href: "/brand" },
      {
        label: "Documentation",
        href: "https://docs.livepeer.org",
        external: true,
      },
    ],
  },
];

// Primary nav per the v6 prototype's signed-in `Sidebar`:
//   Home (G H) → Explore (47) → Jobs (1.2K) → Usage → API keys (3) → Settings ›
// Settings carries a chev-right (rendered by NavLink via `submenu: true`)
// instead of a count, signaling that it leads into a sub-experience — clicking
// it swaps the sidebar contents to a settings rail. Billing is no longer a
// peer of Home; it lives inside the workspace dropdown and inside the settings
// rail. Network is in the sidebar footer.
export const PORTAL_NAV_ITEMS = [
  {
    label: "Home",
    href: "/dashboard",
    icon: "House" as const,
    kbd: "G H",
  },
  {
    label: "Explore",
    href: "/dashboard/explore",
    icon: "LayoutGrid" as const,
  },
  {
    label: "Jobs",
    href: "/dashboard/jobs",
    icon: "Activity" as const,
  },
  { label: "Usage", href: "/dashboard/usage", icon: "BarChart3" as const },
  {
    label: "API keys",
    href: "/dashboard/keys",
    icon: "Key" as const,
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: "Settings" as const,
    submenu: true,
  },
] as const;

export const EXTERNAL_LINKS = {
  docs: "https://docs.livepeer.org",
  explorer: "https://explorer.livepeer.org",
  discord: "https://discord.gg/livepeer",
  twitter: "https://twitter.com/Livepeer",
  github: "https://github.com/livepeer",
  forum: "https://forum.livepeer.org",
  grants: "https://github.com/livepeer/grants",
  studio: "https://livepeer.studio",
  staking: "https://explorer.livepeer.org/",
} as const;
