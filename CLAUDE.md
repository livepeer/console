# CLAUDE.md

**Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Framer Motion 11, Inter (rsms.me) + Geist Mono, Lucide, Recharts. Package manager: **pnpm**. No test framework.

## Commands

- `pnpm dev` — Next.js dev server on localhost:3000
- `pnpm build` — production build (use to verify changes compile)
- `pnpm lint` — ESLint, zero warnings tolerated
- `pnpm typecheck` — tsc --noEmit
- `pnpm format` / `pnpm format:check` — Prettier

## Project structure

```
app/
├── layout.tsx              # Root layout — html/body, Inter + Geist Mono, theme bootstrap (FOUT-safe)
├── globals.css             # Tailwind v4 @theme block + console token layer
├── (app)/                  # Console chrome (sidebar, providers, keyboard shortcuts)
│   ├── layout.tsx
│   ├── page.tsx            # /          → Explore (public; → /home when signed in)
│   ├── explore/page.tsx    # /explore   → Explore (public)
│   ├── home/page.tsx       # /home      → Console home (auth-gated via SignInWall)
│   ├── calls, usage, keys, settings  # auth-gated
│   ├── apps/[id]           # public
│   ├── orgs/[slug]         # public
│   ├── network             # public
│   └── error.tsx
├── (auth)/                 # /login, /signup — no sidebar
└── not-found.tsx

components/
├── console/                # Console surfaces, providers (Auth, Theme), nav, charts, tables
└── design-system/          # Vendored primitives — Badge, Button, Dialog, Drawer,
                            # ErrorState, Select, Skeleton, Tooltip, LivepeerLogo.
                            # TEMPORARY — replace with @livepeer/design-system when published.

lib/
├── console/                # mock-data, types, utils, useStarredModels, model-stats, generate-card-visual
└── constants.ts            # PORTAL_NAV_ITEMS, EXTERNAL_LINKS

public/images/console/    # Model card visuals + daydream logo
```

## Conventions

### First-run flag

The Home (`/home`) shows `<FirstRunChecklist>` for any signed-in user where `localStorage["livepeer.firstRunDismissed"] !== "1"`. Skip / "I've made my first call" / clicking through to the playground all set the flag. The Quickstart sidebar entry clears it and dispatches a same-tab `livepeer:firstrun-changed` CustomEvent so Home re-reads. When real auth lands, AND this with a server-side run-history check.

### Section headings

Use `<SectionHeader>` from `components/console/SectionHeader.tsx`. Console convention is `text-base font-semibold` headings; do not roll ad-hoc `<h2 className="text-base font-semibold">` markup.

### KPI rows

Wrap any row of `<KpiCard>` / `<StatCard>` in `<KpiStrip cols={3 | 4}>` (`components/console/KpiStrip.tsx`). Don't roll ad-hoc `grid grid-cols-2 sm:grid-cols-4` containers — they drift over time.

### Page max-widths

Each page picks one based on content type and uses it for every inner max-width container (header, sticky tab strip, content) so they line up:

- `max-w-5xl` — forms-heavy pages (Settings tabs, Model detail header)
- `max-w-6xl` — data tables / charts (Network, Usage)
- `max-w-7xl` — catalogs / dense grids (Explore, Models list)

There's no shared `<ConsolePage>` wrapper because every page layers a sticky `<TabStrip>` between header and content, requiring the max-width to repeat 2-3 times intentionally per page.

### Cards

Console surfaces use inline classes — typically `rounded-xl border border-hairline bg-{dark-surface|dark-card|transparent}` with `p-4` (data-dense rows) or `p-6` (feature blocks).

### Tables

Tables in the console are intentionally bespoke — Home "Your runs", `UsageTab` activity log, and `PaymentTab` connected-providers all roll their own markup because their interaction patterns differ (sticky mobile/desktop headers, live pulse on most-recent row, highlighted target row, etc.). There is no shared `<DataTable>` primitive. If a future surface needs a generic sortable table, build it then — don't try to back-fit a primitive that compromises the existing surfaces.

### Form-control focus ring

All form controls (`SearchInput`, `Select`, etc.) show `focus-visible:ring-1 focus-visible:ring-green-bright/30`. Don't ship border-only focus states.

### Loading + error states

Suspense boundaries on every console route use `<ConsolePageSkeleton>` as the fallback (`components/console/ConsolePageSkeleton.tsx`). The `(app)/error.tsx` segment-level boundary renders `<ErrorState>` (`components/design-system/ErrorState.tsx`) for any thrown render error, with a request ID + retry + Discord help link.

### Color / token rules

- `globals.css` outside the `@theme` block contains zero raw hex/rgba — use `var(--color-X)` everywhere or `color-mix(in srgb, var(--color-X) N%, transparent)` for opacity-based tints.
- `warm` (orange) is reserved for **liveness/activity** indicators (model warm/cold status, "live" pulses). Never decorative.
- Green = success / primary. Blue = cold / secondary. Red = failure.
- Tokenomics is invisible by default — LPT, staking, orchestrator addresses, on-chain mechanics never appear on Home / Capabilities / Playground / Usage / Settings unless the user explicitly opts into a network/protocol view.

### Iconography

- Lucide React. Default stroke width is 1.5. Override only when the glyph reads too thin at the size you're using (e.g. `Activity` at sizes ≥ 16px reads better at `strokeWidth={1.75}`).
- Sizes: `h-3.5 w-3.5` (14px) for inline label icons, `h-4 w-4` (16px) for buttons / nav, `h-5 w-5` (20px) for cards, `h-10 w-10` (40px) for empty-state hero glyphs.

### Typefaces

`font-sans` is **Inter**, self-hosted from the designer's own distribution
(<https://rsms.me/inter/>, OFL). Files live in `public/fonts/`; the `@font-face`
rules live in `app/fonts.css`, which is **generated** — don't hand-edit it.

Two roman faces are served: a ~107 KB latin+symbols subset (preloaded in
`app/layout.tsx`, the only one most sessions fetch) and the full 344 KB file,
demand-loaded only for non-Latin text such as a user display name. Each face's
`unicode-range` is derived from the actual cmap of the woff2 it points at.

**If you add a non-ASCII glyph to any UI string, run the generator:**

```bash
python3 scripts/build-inter-fonts.py --check
```

It reports any glyph that would fall onto the 344 KB fallback; add those to
`SYMBOLS` in the script and re-run it without `--check` to rebuild. This is not
cosmetic — a single uncovered glyph bills every visitor 344 KB. A stray `✕` did
exactly that. (Glyphs Inter lacks entirely, like `✕` and `▾`, are reported
separately and cost nothing; they render in a system fallback.)

Don't reintroduce a `--font-sans` override in a subtree layout — it would
shadow the variable font.

### Monospace

Use `font-mono` for IDs, hashes, tokens, addresses, model `id` slugs (e.g. `daydream-video`), latency / cost / count numbers (`tabular-nums`). Use the default sans for human names (model display name, model provider, user display name).

### Motion

Existing tokens in `globals.css` `@theme`: `--motion-duration-fast` (150ms, hover/focus), `--motion-duration-base` (200ms, dropdowns/menus), `--motion-duration-slow` (300ms, drawers/dialogs). Easings: `--motion-easing-out` (most exits), `--motion-easing-in` (entries), `--motion-easing-spring` (drawer-style spring). All animations must respect `prefers-reduced-motion: reduce`.

## Design system — vendored, not final

`components/design-system/` is **vendored**. When `@livepeer/design-system` ships as a real package, swap the imports — keep `components/design-system/` as a barrel that re-exports from the package, or delete it entirely. The 38+ console components import from `@/components/design-system/X`, so the swap-out is a single barrel-file change rather than a 38-file rewrite.

## Don't

- **No `next/image`** — use raw `<img>` tags. Some downstream primitives need direct CSS filter/absolute stacking that `next/image`'s wrapper breaks.
- **No global state** — local `useState` only. No state libraries.
- **No backend dependencies** — all data is mock (`lib/console/mock-data.ts`). When the real API lands, replace the mock imports surgically; don't restructure the components around the data layer.
- **No new dependencies without discussion.** The dependency list is intentionally small.
