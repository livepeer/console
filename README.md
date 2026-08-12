# Livepeer Console

The signed-in surface for developers using the Livepeer network — browse AI apps, manage API keys, monitor usage.

## Status

Early development. All data is mock-driven (`lib/console/mock-data.ts`) — there is no backend wired in yet. Auth is stubbed in `components/console/AuthContext.tsx`.

This repo was extracted from [`livepeer/website`](https://github.com/livepeer/website) (branch `claude/dashboard-updates`) and ships independently from the marketing site.

## Tech stack

- Next.js 15 (App Router), React 19, TypeScript
- Tailwind CSS v4 (`@tailwindcss/postcss`)
- Geist Sans + Mono via `geist`
- Framer Motion 11, Lucide icons, Recharts
- Package manager: pnpm

## Commands

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # production build (verify before pushing)
pnpm lint         # ESLint, zero warnings
pnpm typecheck    # tsc --noEmit
```

## Layout

```
app/
├── layout.tsx              # Root: html/body, Geist fonts, theme bootstrap
├── globals.css             # Token layer + console utilities
├── (app)/                  # Console chrome (sidebar, providers)
│   ├── layout.tsx
│   ├── page.tsx            # /  → Explore (public; → /home when signed in)
│   ├── explore/            # /explore (public)
│   ├── home/               # /home (auth-gated)
│   ├── calls, usage, keys, settings  # auth-gated
│   ├── apps/[id]           # public app detail + playground
│   ├── orgs/[slug]         # public org profile
│   └── network             # public network stats
└── (auth)/                 # Login + signup (no sidebar)

components/
├── console/                # All console surfaces
└── design-system/          # Vendored primitives — Badge, Button, Dialog,
                            # Drawer, ErrorState, Select, Skeleton, Tooltip,
                            # LivepeerLogo. Replace with @livepeer/design-system
                            # when that package ships.

lib/
├── console/                # Mock data, types, utils
└── constants.ts            # PORTAL_NAV_ITEMS + EXTERNAL_LINKS
```

## Routes

| URL                | Auth     | Surface                          |
| ------------------ | -------- | -------------------------------- |
| `/`                | public   | Explore — redirects to `/home` when signed in |
| `/explore`         | public   | Explore — app catalog            |
| `/home`            | required | Console home (your runs / KPIs)  |
| `/calls`           | required | Call history                     |
| `/usage`           | required | Account usage                    |
| `/keys`            | required | API keys                         |
| `/settings`        | required | Account settings                 |
| `/apps/[id]`       | public   | App detail + playground          |
| `/orgs/[slug]`     | public   | Organization's published apps    |
| `/network`         | public   | Network stats (sidebar: "Stats") |
| `/login`           | public   | Sign in                          |
| `/signup`          | public   | Sign up                          |

See `CLAUDE.md` for console conventions (KPI rows, tables, motion tokens, color rules).
