# Livepeer Developer Dashboard

The signed-in surface for developers using the Livepeer network — browse AI capabilities, manage API keys, monitor usage.

## Status

Early development. All data is mock-driven (`lib/dashboard/mock-data.ts`) — there is no backend wired in yet. Auth is stubbed in `components/dashboard/AuthContext.tsx`.

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
├── globals.css             # Token layer + dashboard utilities
├── (app)/                  # Dashboard chrome (sidebar, providers)
│   ├── layout.tsx
│   ├── page.tsx            # /  → Explore (public)
│   ├── home/               # /home (auth-gated)
│   ├── jobs, usage, keys, settings  # auth-gated
│   ├── models/[id]         # public model detail
│   └── network             # public network stats
└── (auth)/                 # Login + signup (no sidebar)

components/
├── dashboard/              # All dashboard surfaces
└── design-system/          # Vendored primitives — Badge, Button, Dialog,
                            # Drawer, ErrorState, Select, Skeleton, Tooltip,
                            # LivepeerLogo. Replace with @livepeer/design-system
                            # when that package ships.

lib/
├── dashboard/              # Mock data, types, utils
└── constants.ts            # PORTAL_NAV_ITEMS + EXTERNAL_LINKS
```

## Routes

| URL                | Auth     | Surface                          |
| ------------------ | -------- | -------------------------------- |
| `/`                | public   | Explore — model catalog          |
| `/home`            | required | Dashboard home (your runs / KPIs) |
| `/jobs`            | required | Run history                      |
| `/usage`           | required | Account usage                    |
| `/keys`            | required | API keys                         |
| `/settings`        | required | Account settings                 |
| `/models/[id]`     | public   | Model detail + playground        |
| `/network`         | public   | Network stats                    |
| `/login`           | public   | Sign in                          |
| `/signup`          | public   | Sign up                          |

See `CLAUDE.md` for dashboard conventions (KPI rows, tables, motion tokens, color rules).
