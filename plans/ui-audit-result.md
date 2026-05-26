# Livepeer Developer Dashboard — UI Polish Audit

> Deep audit conducted from three lenses in parallel: design-taste (a senior product designer's first impression), component-craft (every UI primitive's interaction details), and brand-expression (whether the dashboard *looks* like Livepeer or like any-other-shadcn). This document is the source-of-truth reference for the 4-phase craft pass that follows.
>
> Companion to `plans/ux-audit-result.md`. The UX audit fixed *what* the dashboard does and *how it routes a builder*. This audit fixes *how it looks and feels*.
>
> Audit performed against the post-UX-Phase-4 worktree (`claude/dashboard-updates`).

---

## 0. Executive summary

The foundations are solid: a coherent dark palette, the new vertical sidebar (UX phase 1) is clean, the typography system uses two carefully-paired typefaces (Favorit Pro + Favorit Mono). The dashboard works.

Where it falls short of the bar — the bar being Vercel / Linear / Stripe / Raycast / Livepeer's own marketing site — is in **seven systemic gaps**:

1. **Dashboard has no brand expression — separate from "the dashboard should look like marketing," which it shouldn't.** Marketing carries the brand *loud* (full Holographik tile grids, scan lines, liquid glass, particle trails) — that's correct for a sales surface. The dashboard's job is to carry the brand *quiet*: shared colors, typography, voice, plus a small subset of motion vocabulary used as functional liveness signals. Today the dashboard carries almost none of that. 12 keyframes are defined in `globals.css`; only Tailwind's default `animate-ping` is in use. The dashboard-appropriate brand vocabulary (`breathe` / `node-pulse` / `shimmer` / `ctaGlow` for status dots, active nav, progress fills, CTA halos — restrained) sits unused. The marketing-only vocabulary (`scanLine` / `glassSpecular` / etc.) correctly stays in marketing — and should keep staying there. **The fix is not making the dashboard look like marketing. The fix is making it feel like the same company.**
2. **Interactions are lifeless.** Buttons snap. Dropdowns appear instantly (no entrance animation). Hovers are 6%-opacity bumps that read as static on dark surfaces. No active-press feedback anywhere. Disabled = `opacity-50`. Focus rings inconsistent. Framer Motion is installed and used in maybe four places.
3. **Token drift is wider than the prior audit caught.** 12 distinct `text-white/N` opacity values, 5 distinct border opacity values across just 3 surveyed files. `--color-border-hairline` and `--color-border-subtle` exist as tokens and are *unused as Tailwind classes*. `brand-tokens.md` documents an opacity ramp (white/100,/70,/60,/50,/40,/25 with semantic meaning) and the dashboard ignores it. `globals.css` `.tile-bg` uses neutral white `rgba(255,255,255,0.02)`; `brand-tokens.md` specifies green-tinted `rgba(24,121,78,0.04)`. **Spec and code disagree.**
4. **Stock-default chrome.** Recharts charts are pure Recharts. Lucide icons used without unifying stroke-width or size. Browser-default scrollbars peek through. Browser-default text selection (blue) and caret color. `<input type="range">` only adds `accent-green-bright` — track and thumb are browser-rendered.
5. **Component duplication is wider than the prior count.** 12+ inline badge variants (counted exhaustively this round), 3 KPI tile implementations, 6+ inline section-header variants on the home page alone, 4+ ad-hoc copy-button implementations, 3 tab-strip implementations.
6. **Missing primitives.** No Toast / notification system. No Tooltip primitive (the one tooltip in the codebase is hand-rolled). No Skeleton loader. No Toggle. No Checkbox. No unified Code-block. No formal Number-format utility.
7. **Microcopy is generic SaaS.** "Welcome back to the Developer Dashboard." Brand voice is "confident, technical but accessible" — dashboard chrome doesn't carry it. Empty-state copy says "No data yet" instead of inviting next action with character.

The reference standard the audits used was Vercel / Linear / Stripe / Raycast — products where every hover earns its keep, every empty state has wit, every primitive is touched by someone with taste. **Plus Livepeer's own marketing site, which IS that polished** — the dashboard just doesn't know the marketing site exists.

The intended outcome: every surface carries one or two distinctive moments without becoming heavy. Holographik motion vocabulary in service of liveness signals. Tokens that match the spec. Primitives polished to indie-design taste. Microcopy that sounds like Livepeer.

---

## 1. Scope: marketing's job vs. dashboard's job

This is the most important framing in the audit. A polished product family has clear lanes: **marketing persuades**; **dashboard works**. They share a brand, not a visual treatment.

### Marketing-only — stays in `app/(marketing)/**`

These belong to marketing. Importing them into a developer tool would feel like a sales pitch in a working surface — a different kind of off-brand.

- Full Holographik tile-grid backdrop (9×5, prominent)
- B&W video with green tint, contrast/brightness curves
- Pulse trail dot traversing SVG paths via `getPointAtLength()`
- Liquid glass panels (`glassSpecular`, `glassRefraction`, `glassFloat`)
- Vignette radial fades
- Starburst nodes with animated rays at grid intersections
- `imageMaskFlow` — only applies to ImageMask
- `scanLine` as a primary visual effect
- Marketing-paced motion: springy entrances, staggered reveals, hero animations

### Dashboard-only — stays in `app/(dashboard)/**`

These don't belong on marketing surfaces. They're tool ergonomics.

- Cmd+K command palette and keyboard shortcuts
- Toast / notification system
- Tooltip system (with `:focus` keyboard support)
- Skeleton loaders
- Form validation styling (error states, helper text, inline messages)
- Status indicators tied to real network state — small, subtle, real
- Tabular numerals on every comparable number
- Dense table chrome (sticky headers, mobile column legends, scroll cues)
- Code-block selection styling
- Settings primitives: Toggle, Checkbox, Radio
- Compact, scannable IA — no marketing-paced reveals

### Shared — both surfaces, applied with different intensity

| Asset | In marketing | In dashboard |
|---|---|---|
| Color tokens (green / dark / warm) | Full saturation in hero gradients | Same tokens, applied with restraint |
| Typography (Favorit Pro + Mono) | Display weights, hero sizes | Body weights, dense scales |
| Brand voice ("confident, technical but accessible") | Headline-loud | Microcopy-quiet |
| Logo system (Symbol / Wordmark / Lockup) | Lockup in hero, prominent | Wordmark in sidebar, never lockup |
| `divider-gradient` utility | Decorative section breaks | Same — works in both |
| `tile-bg` utility | Full-bleed, visible | **Splash surfaces only (login)** — faint, almost invisible |
| `breathe` keyframe | Loud, on geometric shapes | Subtle, on status-dot halos and active-nav indicators |
| `node-pulse` keyframe | Repeating | One-shot only — sidebar logo on initial mount |
| `shimmer` keyframe | Decorative highlights | Loading micro-moments — progress-bar fill while animating |
| `ctaGlow` keyframe | Marketing CTA halos, prominent | Subtle hover halo on primary action buttons only |
| `arrowFlow` keyframe | Arrow pulse | Optional — "View all →" arrows |
| `twinkle` keyframe | Stars | Optional — micro confirmations |

### Keyframe inventory by intended scope

| Keyframe | Marketing | Dashboard | Notes |
|---|---|---|---|
| `breathe` | ✓ | ✓ subtle | Status dot halos, active nav indicator |
| `node-pulse` | ✓ | ✓ one-shot | Sidebar logo on mount only |
| `shimmer` | ✓ | ✓ loading micro | Progress bar fill while animating |
| `ctaGlow` | ✓ | ✓ subtle | Primary CTA hover halo |
| `arrowFlow` | ✓ | ✓ optional | "View all →" pulse |
| `twinkle` | ✓ | ✓ optional | Star button activation |
| `scanLine` | ✓ | ✗ | Theatrical CRT effect — wrong tone for a working tool |
| `dashFlow` | ✓ | ✗ | Theatrical for buttons — defer |
| `glassSpecular` | ✓ | ✗ | Liquid-glass shine; dashboard cards stay matte |
| `glassRefraction` | ✓ | ✗ | Marketing only |
| `glassFloat` | ✓ | ✗ | Marketing only |
| `imageMaskFlow` | ✓ | ✗ | Only applies to ImageMask which is marketing |

### What this audit's recommendations apply to

Everything from §2 onward concerns the **dashboard-appropriate** subset only. Marketing surfaces are deliberately out of scope. When this audit recommends bringing brand vocabulary into the dashboard, it's the right-hand column of the keyframe table — never the left-only column.

The temptation will be to import marketing visuals to "fix the cliff." Resist it. The cliff between a polished marketing site and a polished tool is *expected* — it's how the user knows they've arrived at the working surface. The bug is not the cliff. The bug is the dashboard's failure to carry the small, restrained brand subset that's appropriate for a tool.

---

## 2. Findings by surface

Each surface is walked first-impression style. Severity tags: ✨ delight opportunity / 🔧 polish / 🎯 brand / 🪶 craft.

### 2.1 `/dashboard/login`

The first impression of the product.

- 🎯 Plain dark background. No `.tile-bg`. No geometric accent. Could carry the brand quietly with a faint green-tinted grid + a single circle/crosshair at a grid intersection. (`LoginPage.tsx:98`)
- 🎯 The radial-gradient backdrop uses a *warm* color (`rgba(245,158,11,0.04)`-ish via line 115). Per `brand-tokens.md`: warm is reserved for liveness/activity, never decoration. **Brand rule violation.** Replace with green-bright tint.
- 🪶 H1 weight is `font-medium text-[28px]`. Should be `font-bold` for hero confidence. Add `text-balance` to keep long names from orphaning. (`LoginPage.tsx:152`)
- 🪶 OAuth buttons are stock shadcn-style. GitHub got a "Popular" pill in UX phase 4 — at very narrow widths it overlaps the GitHub icon. Add safety margin or hide below 360px.
- 🪶 Form inputs lose focus rings: `focus:border-white/20` only. No ring. Should be `focus:ring-1 focus:ring-green-bright/30 focus:border-white/30`.
- 🪶 The "or" divider uses `tracking-widest` on a 2-letter word. On narrow viewports it can wrap awkwardly. Consider a horizontal-rule with a centered "or" pill.
- 🎯 Microcopy: "Log in to the Developer Dashboard" / "Get started with the open GPU network." Generic. Could be "Welcome to the open network" or "Log in to build with Livepeer." Inject brand voice.
- 🪶 Disabled submit uses `opacity-50`. Should explicitly grey: `disabled:bg-white/[0.06] disabled:text-fg-disabled disabled:cursor-not-allowed`.

### 2.2 `/dashboard` home (returning + first-time)

- 🎯 Welcome card (returning): `bg-dark-card` with subtle radial highlight. No brand pattern. **Skip `tile-bg` here** — the dashboard's brand presence comes from typography, color, and motion subtleties, not from importing marketing's structural grid into the working surface. Keep the card clean.
- 🪶 Hero H1 (returning): "Good to see you, {firstName}." `text-xl font-semibold`. Should be `font-bold sm:text-2xl` with `text-balance`.
- 🔧 Section headers duplicated 6+ times with subtle markup variants — Featured / Starred / Suggested / Browse by category / Get started / Recent requests. None use the existing `<SectionHeader>` primitive. (`dashboard/page.tsx:265,304,349,443,512,552,627`)
- 🔧 Grid breakpoints drift: Featured `lg:grid-cols-4`, Starred `sm:grid-cols-2 lg:grid-cols-4`, Browse `sm:grid-cols-3 lg:grid-cols-4`, Get-started `sm:grid-cols-2 lg:grid-cols-4`. Pick one and apply uniformly. (`page.tsx:276,319,454,513`)
- 🪶 First-time WelcomeCard progress ring snaps to position. The SVG `stroke-dashoffset` transition is `duration-500` linear. Should use `ease-out` and ALSO breathe subtly while incomplete (`breathe` keyframe, 4s).
- ✨ Free-tier progress bar (`page.tsx:647-652`): plain green-bright fill. Could `shimmer` along the fill while animating to value — uses an existing keyframe, instant brand presence.
- 🪶 Recent Requests rows use `hover:bg-white/[0.02]` — barely perceptible. Bump to `hover:bg-white/[0.04]`.
- 🔧 Returning-user KPI tiles are inline (`KpiTile` function in `page.tsx`) — separate implementation from `StatCard.tsx` and the inline KPI rows in `UsageTab.tsx`. Three KPI implementations.

### 2.3 `/dashboard/explore`

- 🎯 **Two left rails.** The global sidebar plus a `w-[260px] bg-shell border-r border-white/10` filter sidebar at line 406. Same surface tier, same border style — they read as fused. (Same pattern repeats on Settings + Network.)
- 🔧 Sticky toolbar at line 584: `bg-dark-surface/95 backdrop-blur-xl`. As cards scroll under, they bleed through the toolbar. Reads as floating glass. Should be solid `bg-dark` with hairline border-bottom.
- 🪶 Filter pill default contrast: `bg-white/[0.06] text-white/60` ≈ 2.5:1 on dark. Borderline WCAG AA. Hover correctly bumps to `bg-white/[0.1] text-white`. Default should match hover. (`explore/page.tsx:602`)
- 🪶 Empty-state icon (`explore/page.tsx:99`): `Search` icon at `text-white/30` inside `bg-white/[0.02]` pill — both nearly invisible. Bump to `text-white/50` and `bg-white/[0.06]`.
- 🪶 Inactive price-histogram bars at `white/[0.06]`. Active range at `rgba(64,191,134,0.5)`. Wash-out contrast. Bump inactive to `white/[0.12]`.
- 🪶 ModelListItem row dividers `white/[0.04]` thinner than card borders `white/[0.08]`. Inconsistent border weight.
- 🪶 ModelCard hover border: `hover:border-white/[0.14]` — 6% opacity bump. Imperceptible. Use `hover:border-strong` token (Phase 1) plus a subtle shadow lift. **No `glassSpecular` sweep** — that's marketing-card energy and would feel sales-y on a tool. Cards stay matte.
- 🪶 NEW badge `top-2 left-2` no margin safety from the card edge. Move to `top-3 left-3`.
- 🪶 Star button `opacity-0 group-hover:opacity-100` with no reserved space — causes layout shift on hover (CLS). Reserve invisible placeholder.
- 🪶 ModelCard provider label is `font-mono text-[11px] uppercase tracking-wider`. Mono on a card title row is harsh. Use `font-sans` with same all-caps treatment — the brand gets its technical voice without the typography clash.

### 2.4 `/dashboard/models/[id]` (model detail)

- 🪶 "Output" label `text-white/50` (`models/[id]:226`) — section heading rendered as faint secondary. Should be `text-fg-muted`.
- 🪶 Tab strip height inversion: `h-9` mobile, `sm:h-7` desktop — tabs SHRINK on bigger screens. Should be `h-9 sm:h-8`. (`models/[id]:158`)
- 🔧 Disabled Run button `disabled:opacity-50`. Reads as broken green button, not disabled. Replace with explicit `disabled:bg-white/[0.06] disabled:text-fg-disabled`.
- ✨ Run button could have a subtle `ctaGlow` halo on hover — quiet hover affordance only, not a "console firing" effect. **No `dashFlow` on click** — too theatrical for a working button.
- 🪶 Tabs (Playground / API / README / Stats) use `border-b-2` underline that snaps between tabs. Should slide via Framer Motion `layoutId`.
- 🪶 Hero metadata pills (warm/cold + realtime + category + runs + latency + GPUs) flex-wrap into a dense slab on narrow viewports. UX Phase 2 hid runs/latency/GPUs on mobile; verify and clean.
- ✨ Code snippets selection uses browser-default blue. Should be branded green-bright/25.
- 🎯 Hero provider/name pairing currently plain. Could use `font-mono uppercase tracking-wider` on the provider for technical voice, sans for the model name — pairing the two typefaces with intent.

### 2.5 `/dashboard/usage`

- 🔧 KPI tiles padding rhythm differs from Network's `StatCard`. Both should use one `<KpiCard>` primitive.
- 🔧 Activity log row dividers at `border-white/[0.06]` are appropriate. Sticky mobile legend (UX Phase 4) at `top-[33px]` — magic number tied to the row above. Should be calculated from a token.
- ✨ Recent requests log: improve typographic discipline — `tabular-nums` on the cost column, mono-aligned timestamps, a tiny "live" pulse next to the most recent row when auto-refresh is on. **No `scanLine` overlay** — CRT theater belongs on marketing; the dashboard's "control-room feel" comes from clarity, not effects.
- 🪶 Provider color swatch dots in legend rendered inline with hex codes. Should align with Network "Payments" tab provider colors.

### 2.6 `/dashboard/settings` (Account / Tokens / Billing)

- 🎯 Secondary sidebar (§2.3 nested-sidebars pattern). Convert to horizontal tabs.
- 🪶 Settings sidebar header "Settings" label at `text-white/50` faint for a section header. Bump to `text-fg-muted`.
- 🪶 Sidebar width hardcoded `w-[260px]`, doesn't match the global sidebar's `w-60` (240px). Standardize once tabs replace the sidebar.
- 🪶 AccountTab profile summary card padding `px-4 py-3.5` — half-pixel py. Round to `py-4` or `py-3`.
- 🪶 ApiKeysTab "Advanced" expand toggle uses `text-white/40` — blends into background. Bump and consider arrow-rotation polish.

### 2.7 `/dashboard/network` (Overview / Utilization / Payments / GPUs)

- 🎯 Secondary sidebar. Convert to horizontal tabs.
- 🔧 StatCard variant differs from home `KpiTile` and UsageTab inline. Padding, label weight, value typography subtly different. Unify.
- 🎯 All charts are pure Recharts defaults. Recharts ships with default axis ticks, default tooltip backgrounds, default bar shapes. **A polished dashboard custom-styles every chart.** Branded color palette per provider. Rounded bar tops `radius={[4,4,0,0]}`. `font-mono` axis ticks at `text-fg-label`. `border-hairline` grid lines. Stagger on mount.
- 🔧 Chart tooltip (`ChartTooltip.tsx`) uses `bg-dark-card/95 backdrop-blur-xl`. The `/95` opacity makes the blur barely visible. Drop to `/80`. Add `shadow-2xl shadow-black/40` for float.
- 🪶 PaymentsTab table uses `font-mono` for ETH amounts but `font-sans` for orchestrator addresses. Both should be mono.
- 🪶 GpusTab hover popover background tier differs from model-detail tab strip. Pick one popover surface.
- 🪶 Tab labels mix sentence case ("Overview", "Utilization") with plural ("Payments", "GPUs"). Pick one style.

### 2.8 Sidebar (`DashboardSidebar.tsx`)

- ✨ Logo on initial mount: brief `node-pulse` once (1.2s, then static). Signals "the network is alive" on every dashboard view.
- ✨ Active nav item indicator (2px green-bright bar): subtle `breathe` on opacity (0.7→1→0.7, 4s loop) — quiet liveness.
- 🪶 Collapsed-rail width `md:w-14` (56px). Icons `h-4 w-4` in 36px buttons. Centered well, but 12px gap to edge feels generous. `md:w-12` would tighten without losing tap target.
- 🪶 Hydration RAF guard for transition timing is correct but adds complexity. Could use `useLayoutEffect` for simpler pattern.
- ✨ Footer status indicator: branded `breathe` halo + center-dot pattern (Phase 2 status indicator polish).

### 2.9 Footer (`DashboardFooter.tsx`)

- 🪶 Mobile legal text `text-white/40`. On `bg-shell` (#0e0e0e) borderline legible. Should be `text-fg-faint` (white/0.50).
- 🪶 Network status pulse uses `animate-ping` — Tailwind default, harsh sudden disappear. Should use brand `breathe` keyframe with halo + center pattern.
- ✨ "All services online" tooltip is hand-rolled. Should use the new `<Tooltip>` primitive (Phase 2).

### 2.10 Cmd+K command palette (`DashboardSearch.tsx`)

- 🪶 Opens instantly. Linear/Raycast scale + fade in. Use `motion.div` with `initial={{ opacity: 0, scale: 0.95 }}`.
- 🪶 Highlighted row `bg-white/[0.05]` too subtle. Bump to `bg-white/[0.08]` plus a left accent in green for the focused item.
- 🪶 All result icons are `ArrowRight` — generic. Result-type icons (Zap for actions, FileText for docs, Settings for pages) signal type.
- 🪶 Suggestions section label "Suggestions" at `text-white/30 tracking-widest` is noise. Either drop or shrink.
- 🪶 Footer tip text static. Could rotate through example queries to seed exploration.

### 2.11 Cross-cutting — motion timing inventory

Four different motion idioms across four similar interactions:
- AvatarMenu dropdown: 150ms cubic-bezier
- DashboardSectionSelect: instant (no transition)
- Model-detail tab switch: instant
- Modal open/close: 300ms (Dialog default)

Should consolidate to a single 200ms `ease-out` for all overlay-style transitions; modals stay at 300ms (heavier).

---

## 3. Findings by primitive

### 3.1 Buttons (`components/ui/Button.tsx`)

- 🪶 No active/pressed feedback. Color shift alone is insufficient — user can't tell they pressed. Add `active:scale-[0.98]` to all variants.
- 🪶 No hover lift on primary. Should `hover:shadow-lg hover:shadow-green-bright/20` for tactile feel.
- 🪶 Secondary hover is opacity-only `hover:bg-white/10`. Should bump border too: `hover:border-white/40 hover:bg-white/[0.08]`.
- 🪶 White variant disabled is `opacity-30` — text becomes nearly invisible against light neutral surfaces. Use explicit `disabled:bg-white/60 disabled:text-black/40`.
- 🪶 Focus ring uses `focus-visible:outline-green` (browser outline). Should be ring-based: `focus-visible:ring-2 focus-visible:ring-green-bright/50` for branded affordance.
- 🪶 Size scale: `sm` and `md` and `lg` all use `text-sm` — no text-size hierarchy. `lg` should bump to `text-base`.
- 🪶 Radius is fixed `rounded-lg` for all sizes. Should scale: sm `rounded-md`, md `rounded-lg`, lg `rounded-xl`.

### 3.2 Inputs (text/textarea/range)

- 🪶 Default border `border-white/[0.08]` too subtle. Bump to `white/[0.12]`.
- 🪶 No hover state. Inputs should acknowledge hover before click.
- 🪶 Focus state is border-only `focus:border-white/20`. No background shift, no ring. Should be `focus:border-white/30 focus:bg-white/[0.06] focus:ring-1 focus:ring-green-bright/30`.
- 🪶 Placeholder text `text-white/40` on `bg-white/[0.03]` ≈ 2.4:1 — fails WCAG AA on small text. Bump background OR text contrast.
- 🪶 No error variant. Forms have nowhere to render validation errors with branded styling.
- 🪶 No disabled variant.
- 🪶 Caret color browser default (white). Should be `caret-green-bright`.
- 🪶 Selection color browser default (blue). Should be branded green-bright/25.
- 🪶 `<input type="range">` only adds `accent-green-bright`. Track and thumb are browser-rendered. Custom `::-webkit-slider-thumb` (4px wide vertical line, branded color) and track styling are missing.

### 3.3 Select / dropdowns / RowMenu / AvatarMenu

- 🪶 Menu opens instantly. No entrance animation. Should `motion.div` with `scale 0.95→1, opacity 0→1, y -4→0` 200ms ease-out.
- 🪶 Item hover `hover:bg-white/[0.04]` too subtle. Bump to `bg-white/[0.08]`.
- 🪶 Keyboard-focused item gets the same treatment as mouse-hovered. Should distinguish: focused gets `ring-2 ring-inset ring-green-bright/40`.
- 🪶 Selected checkmark animation absent — Lucide `Check` icon appears statically. Should `scale 0.5→1` on selection.
- 🪶 Multi-select divider `border-white/[0.06]` too subtle. Use `border-subtle` (Phase 1).
- 🪶 Disabled items use `text-white/30` — no `cursor-not-allowed`, no visible distinction beyond color.

### 3.4 Dialog (`components/ui/Dialog.tsx`)

- 🪶 No entrance animation — appears instantly. Should fade + scale in via Framer Motion.
- 🪶 Backdrop is `bg-black/60 backdrop-blur-sm`. No fade transition — backdrop appears with the panel. Should fade independently.
- 🪶 Panel position `pt-[15vh]` — arbitrary. Should center vertically or use a more reasoned offset.
- 🪶 No focus trap. Tabbing past the last focusable element escapes the dialog (a11y issue).
- 🪶 No `motion.div` integration — adding entrance animation later requires retrofitting.

### 3.5 Drawer (`components/ui/Drawer.tsx`)

- 🪶 Drag handle at `h-1 w-10 rounded-full bg-white/20` — visual only, not draggable. Either implement drag-to-dismiss or remove (signals affordance that doesn't exist).
- 🪶 Easing `cubic-bezier(0.32,0.72,0,1)` is bouncy spring. For a drawer, smoother `ease-out` (`cubic-bezier(0.4,0,0.2,1)`) typically more satisfying. Acceptable as "spring" idiom but inconsistent with rest of motion vocab.
- 🪶 Focus trap not implemented.
- 🪶 No fade on backdrop during exit (only panel translates).
- 🪶 Mobile-only design implicitly assumed; on tablet/desktop landscape, full-height bottom sheet looks odd. Could have a breakpoint variant that renders as centered modal.

### 3.6 Tabs (`DashboardSubNav` + new horizontal tabs in Phase 1)

- 🪶 Active indicator `border-b-2` snaps between tabs. Should slide via `motion.div layoutId`.
- 🪶 Inactive hover `hover:text-white/90` only — no background shift. Should `hover:bg-white/[0.04]`.
- 🪶 `h-11` mobile / `h-7` desktop — height SHRINKS on bigger screens. Should be `h-10 sm:h-9` or similar — never shrinking.
- 🪶 Edge fade gradients fixed `w-8`. Should scale: `w-6 sm:w-8`.
- 🪶 Icon-only tabs missing `aria-label`/`title`.

### 3.7 Cards (`Card.tsx`, `ModelCard.tsx`, KPI tiles)

- 🪶 Hover only changes border (`white/[0.08]` → `white/[0.14]`) — invisible on dark. Should be border + bg + shadow lift in concert.
- 🪶 `Card.tsx` default border `border-dark-border` (`#2a2a2a`) is darker than `bg-dark-card` (`#1e1e1e`). Should be `border-subtle` (white at 10%).
- 🪶 Padding fixed `p-6` — no responsive option. Should be `p-4 sm:p-6` or expose as prop.
- 🪶 ModelCard cover `aspect-[16/10]` — odd ratio. Standardize to `aspect-video` (16:9) for consistency.
- 🔧 Three KPI implementations: `StatCard.tsx`, inline `KpiTile` in `dashboard/page.tsx`, inline KPI rows in `UsageTab.tsx`.

### 3.8 Badges — 12+ inline variants

Inventoried by the craft pass:

| # | Source | Style |
|---|---|---|
| 1 | `Badge.tsx` default | `rounded-full border-green/30 bg-green-subtle text-green-light px-3 py-1 text-xs` |
| 2 | `Badge.tsx` app | `rounded-md border-green-bright/40 bg-green-bright/10 text-green-bright px-2.5 py-0.5 text-[11px]` |
| 3 | `Badge.tsx` category | `rounded border-transparent bg-white/[0.10] text-white/50 px-2.5 py-0.5 text-[11px]` |
| 4 | `Badge.tsx` tag | `rounded border-transparent bg-white/[0.06] text-white/30 px-2.5 py-0.5 text-[11px]` |
| 5 | `Badge.tsx` neutral | `rounded-full border-transparent bg-white/[0.06] text-white/40 px-1.5 py-[1px] text-[9px]` |
| 6 | UtilizationTab status | dynamic colors on `active`/`online`/`degraded`/`cold`/`completed` |
| 7 | ModelCard warm | `rounded-full bg-black/50 px-2 py-1 text-[11px] backdrop-blur-sm` w/ ping dot |
| 8 | ApiKeysTab scope pill | `rounded-full px-2.5 py-1 text-[11px]` w/ dynamic border/bg |
| 9 | PlaygroundForm type | `rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-mono text-white/50` |
| 10 | PlaygroundForm required | inline `text-red-400` asterisk |
| 11 | UtilizationTab LIVE | `rounded-full bg-green-bright/10 px-2.5 py-1 text-[11px] text-green-bright` w/ pulse |
| 12 | ModelCard NEW | `rounded-md bg-green-bright px-2 py-1 text-[11px] text-dark` w/ Sparkles icon |

Padding (`px-1.5 py-[1px]` to `px-3 py-1`), radius (`rounded` / `rounded-md` / `rounded-full`), background tier — all drift. **Action:** extend existing `<Badge>` with a unified system (Phase 2).

### 3.9 Status indicators (`NetworkStatusDot`, ModelCard warm)

- 🔧 `animate-ping` is Tailwind default — 1s loop, opacity 0→1 with sudden cutoff. Looks glitchy on quiet UI. Should use brand `breathe` (smooth opacity oscillation) or `node-pulse`.
- 🪶 Halo + center pattern absent — just one pulsing dot. Should be: halo (animated breathe, lower opacity) behind a static center dot (full opacity).
- 🪶 No semantic variants (offline = red, warning = amber). Hardcoded green.

### 3.10 Tooltips — gap

Search confirms: no `<Tooltip>` primitive. The one tooltip in the codebase is hand-rolled in `NetworkStatusDot.tsx` using CSS `:hover` opacity. Native `title=` attributes used everywhere else (e.g., `KeyBadge`, collapsed sidebar nav links). **Native `title=` looks like default browser tooltips — terrible.** Need a proper primitive with positioning, delay, animation, keyboard accessibility.

### 3.11 Toasts — gap

No toast / notification system. Form save feedback is inline button text swap ("Update" → "Saved"). API key creation → no confirmation. Async errors → no surface. **Need a toast system.**

### 3.12 Skeletons — gap

Loading states are inconsistent: spinner border (Run button), shimmer-by-mention-only (`PlaygroundOutput`), nothing on most KPI cards / tables / charts. **No unified `<Skeleton>` primitive.**

### 3.13 Toggle / Checkbox — gaps

No `<Toggle>` (switch). No `<Checkbox>` (the Select component uses Lucide `Check` for selection but there's no standalone checkbox). Settings pages will need both as features grow.

### 3.14 Code blocks (`CodeSnippets.tsx`)

- 🪶 No syntax highlighting — code is monochrome `text-white/60`. A polished dev tool has highlighting.
- 🪶 Selection color browser default — should be branded green-bright/25.
- 🪶 No line numbers (defensible — keeps it clean).
- 🪶 Line-height `leading-relaxed` is good but unset elsewhere.
- 🪶 Long lines wrap by default — should `overflow-x-auto` to preserve syntax.

### 3.15 Forms

- 🪶 Field rhythm uneven — label-to-input gaps vary (`mb-1.5` here, no margin there).
- 🪶 No `<fieldset>`/`<legend>` grouping for related fields.
- 🪶 No error message component — validation errors have no styled home.
- 🪶 No success feedback beyond inline button text swap. A toast system would help.
- 🪶 Tab order not enforced.

### 3.16 Iconography (Lucide everywhere)

- 🪶 Stroke widths inconsistent. Lucide default is 2; some icons override (e.g. `strokeWidth={2.25}` on Sparkles in ModelCard). No documented spec.
- 🪶 Sizes drift: `h-3 w-3` (12px), `h-3.5 w-3.5` (14px), `h-4 w-4` (16px), `h-5 w-5` (20px), `h-6 w-6` (24px) all used without rules.
- 🪶 Color matching to text x-heights inconsistent — sometimes icons sit slightly above or below the text baseline.
- 🪶 Lucide is generic. The brand has custom icons (`LivepeerSymbol`, `LivepeerWordmark`, `LivepeerLockup`) but there's no consideration of where custom > generic. The geometric "starburst node" / "play-button blockchain" symbol vocabulary could inspire a small set of dashboard-specific icons (status, credentials, network) — deferred (Phase 4 out-of-scope).

### 3.17 Cursor styling

- 🪶 `globals.css` adds `cursor: pointer` to buttons/links. But:
- 🪶 Disabled buttons inherit `cursor: pointer` (should be `not-allowed`).
- 🪶 Form labels inherit pointer (should be `default` or `text` near inputs).
- 🪶 Drawer drag handle should be `grab`/`grabbing` if implemented (or remove handle).

### 3.18 Scrollbars

- 🪶 `.scrollbar-dark` defined and applied in some containers. `.scrollbar-none` for tab strips. Inconsistent application — many overflow areas show default browser scrollbars. Audit + apply consistently.

### 3.19 Numbers / formatting

- 🪶 `font-variant-numeric: tabular-nums` not applied to KPI values, chart tick labels, or tables. Numbers shift width when values change.
- 🪶 Decimal precision inconsistent across surfaces.
- 🪶 Large numbers: "1.2k" / "1,200" / "1200" all coexist. Need a `formatCount()` utility everyone uses.

### 3.20 Animations & motion vocabulary

- ✨ 12 keyframe animations defined in globals.css. ~1 used in dashboard (`animate-ping`, which is Tailwind default — not even ours). The brand vocabulary is sitting unused.
- 🪶 Motion timing inconsistent — see §2.11.
- 🪶 No documented animation policy. Phase 1 of the plan adds one.

---

## 4. Brand-expression gaps

### 4.1 Brand keyframes — what dashboard should adopt vs. defer

Cross-reference the keyframe scope table in §1. The animations the dashboard SHOULD use are the small subset; the rest stay marketing-only.

| Keyframe | Marketing | Dashboard | Used today? | Where to apply (dashboard only) |
|---|---|---|---|---|
| `breathe` | ✓ | ✓ subtle | ✗ | Status dot halos, active nav indicator |
| `node-pulse` | ✓ | ✓ one-shot | ✗ | Sidebar logo on initial mount only |
| `shimmer` | ✓ | ✓ loading micro | ✗ | Free-tier progress bar fill (while animating to value), skeleton loaders |
| `ctaGlow` | ✓ | ✓ subtle | ✗ | Primary CTA hover halo — quiet only |
| `arrowFlow` | ✓ | ✓ optional | ✗ | "View all →" link pulse — small |
| `twinkle` | ✓ | ✓ optional | ✗ | Star-button activation — small |
| `scanLine` | ✓ | ✗ marketing-only | ✗ | (Don't import — too theatrical for working surfaces) |
| `dashFlow` | ✓ | ✗ marketing-only | ✗ | (Don't import — too theatrical for buttons) |
| `glassSpecular` | ✓ | ✗ marketing-only | ✗ | (Don't import — liquid-glass shine is for marketing cards) |
| `glassRefraction` | ✓ | ✗ marketing-only | ✗ | — |
| `glassFloat` | ✓ | ✗ marketing-only | ✗ | — |
| `imageMaskFlow` | ✓ | ✗ marketing-only | ✗ | (Only applies to ImageMask which is marketing) |

The actionable gap: 6 of these (`breathe`, `node-pulse`, `shimmer`, `ctaGlow`, `arrowFlow`, `twinkle`) are dashboard-appropriate and unused. Phase 3 wires them in — sparingly, tied to functional moments, never decoratively.

### 4.2 `.tile-bg` utility — zero dashboard usage (and that's mostly correct)

Defined in `globals.css` (line 69-74). Spec'd in `brand-tokens.md` as the brand's structural pattern. **Used: never in dashboard.**

**The right answer here is restraint.** Dashboard surfaces are working tools — a structural grid pattern doesn't help them work better, it adds visual noise. Most dashboard surfaces should stay clean.

The single appropriate place: **the login page.** It's the splash / brand-handoff moment between marketing and dashboard. A nearly-invisible `tile-bg` at very low opacity (1-2%) anchors brand identity without being decorative for the working surface. **Skip `tile-bg` everywhere else** — sidebar, hero cards, empty states stay clean.

**Bug to fix in Phase 1:** spec says `rgba(24,121,78,0.04)` (green-tinted); `globals.css` implements `rgba(255,255,255,0.02)` (neutral white). Even with limited dashboard usage, the spec/code mismatch should be reconciled — and the green-tinted version is the brand-correct one.

### 4.3 Color emotion — warm misused, green-bright underused

- 🎯 **Warm misuse on login.** Brand rule from `brand-tokens.md`: "Reserved exclusively for liveness and activity indicators... Not a decorative color." `LoginPage.tsx:115` uses warm in a decorative radial gradient. Replace with green-bright.
- 🎯 **Green-bright underused.** It's the "delight accent" per brand. Currently only on link hover and ModelCard hover text. Should also: pulse on active nav, glow on form focus rings, shimmer on progress bar fills, halo on CTA hovers.

### 4.4 Typography weights underused

- Favorit Pro available in Light (300), Book (400), Regular, Medium (500), Bold (700). Dashboard uses Medium and Semibold (which Tailwind interprets as 500/600). **Light and Book never used.** Could be: hero captions, decorative numerals, secondary labels.
- Hero H1s are `font-medium` or `font-semibold`. Should be `font-bold` for hero confidence.
- Mono Bold (700) is the brand spec for stats — currently using `font-semibold` on KPI values.

### 4.5 Brand voice missing in microcopy

| Surface | Current | Brand-voice draft |
|---|---|---|
| Login signin H1 | "Log in to the Developer Dashboard" | "Welcome back to the open network" |
| Login signup H1 | "Create your account" | "Join the network" or "Build with Livepeer" |
| Welcome card | "Welcome to the Livepeer Developer Dashboard." | "Welcome, {firstName}. Let's run your first inference." |
| Empty state | "No data yet" | "No inferences yet. [Run a model →]" |
| Run button | "Run" | "Run" (fine) or "Run inference" |
| Free-tier KPI | "Free tier remaining: 8,796 / 10,000" | (already good, keep) |

### 4.6 Iconography generic

Lucide icons used throughout. No exploration of where custom brand icons (riffing on the Livepeer Symbol's geometric language) could replace them — particularly for nav items, status, credentials, network. **Deferred to a future ticket** (out of scope for this plan; design effort).

### 4.7 The "control room" aesthetic — apply with restraint, not theater

The brand thesis includes "outer space control room — technical, cinematic." It would be tempting to read this as a license to put scan lines, dash flows, and CRT effects on the dashboard. **Don't.** That language describes the brand's *cinematic identity* — it's content for marketing surfaces.

In the dashboard, "control-room feel" comes from **clarity**, not effects:
- `font-mono` where it serves data alignment (KPI values, timestamps, addresses, request IDs) — not as a decorative theme
- `tabular-nums` so numbers don't shift width
- Branded text-selection color (green-bright/25) so highlighting code feels native to the brand
- Tight, scannable IA (already good post-UX-audit)
- Real-time signals tied to real state (the network status dot pulse with `breathe`) — small, honest

Surface-level applications (refined Phase 3 list):
- Recent Requests log → typographic discipline (mono timestamps, tabular-nums cost column, tiny live-update indicator). No scan-line.
- API key display → already uses `<KeyBadge>` (good). Don't add decorative chrome.
- Code blocks → mono with line-height tuning, branded selection. No scan-line overlay.
- Stats charts → branded color palette, mono axis ticks, hairline grid lines, stagger-on-mount. No theatrical effects.
- Run-inference button → subtle `ctaGlow` halo on hover. No `dashFlow` on click.

**The rule:** if a brand vocabulary element belongs in a sales surface to make a point, it doesn't belong in a tool surface. The tool earns brand trust by being polished and consistent — not by referencing the marketing aesthetic.

---

## 5. Token inventory + drift

### 5.1 Defined and used correctly

- Colors: green family, blue family, warm family, dark surface ramp (shell / dark / dark-surface / dark-card / surface-raised). All in active use.
- Typography: `--font-sans`, `--font-mono`. Used.

### 5.2 Defined and unused

- `--color-border-hairline` (rgba 255,255,255,0.06)
- `--color-border-subtle` (rgba 255,255,255,0.10)
- 11 of 12 keyframe animations
- `.tile-bg` utility class

### 5.3 Documented in `brand-tokens.md` but missing from `globals.css`

- Semantic foreground ramp (text-white/100, /70, /60, /50, /40, /25 with documented meaning). Should become `--color-fg-*` tokens (Phase 1).
- `--color-border-strong` tier (would correspond to white/0.15) — not defined.

### 5.4 Spec-vs-code mismatches

- `.tile-bg`: brand spec says green-tinted, code implements neutral white. Fix in Phase 1.
- `.divider-gradient`: brand spec says peak white at 15-20% in center; code implements 6%. Fix in Phase 1.

### 5.5 Drift counts (across just `dashboard/page.tsx`, `explore/page.tsx`, `UsageTab.tsx`)

- 12 distinct `text-white/N` opacity values
- 5 distinct border opacity values
- 5 distinct font sizes (text-[11/12/13/14/15/...])
- 4 distinct radius values (rounded / rounded-md / rounded-lg / rounded-xl / rounded-2xl)

---

## 6. Component duplication map

| Duplicated pattern | Variants today | Single primitive |
|---|---|---|
| Section headers | 6+ inline on home alone | Reuse existing `<SectionHeader>` from `components/ui/` |
| KPI tiles | 3 (StatCard, KpiTile, UsageTab inline) | New `<KpiCard>` |
| Badges | 12+ inline | Extend `<Badge>` |
| Copy buttons | 4 ad-hoc + canonical in `KeyBadge` | New `<CopyButton>` (extract from KeyBadge) |
| Tab strips | 3 (DashboardSubNav, Settings sidebar, Network sidebar) | New `<TabStrip>` (or generalize SubNav) |
| Status indicator dots | 2 (NetworkStatusDot, ModelCard warm) | New `<StatusDot>` with halo + center pattern |
| Empty states | `<EmptyState>` exists but 3 variants are visually similar | Variant work in Phase 3 |

---

## 7. Missing primitives

- **`<Toast>` + `useToast()`** — no notification surface today
- **`<Tooltip>`** — replaces native `title=` and the one hand-rolled tooltip
- **`<Skeleton>`** — unified loading placeholder (text / card / chart / circle variants)
- **`<Toggle>`** (switch) — no boolean toggle exists
- **`<Checkbox>`** — no standalone checkbox
- **`<KpiCard>`** — replaces 3 KPI implementations
- **`<CopyButton>`** — replaces 4 ad-hoc copies
- **`<TabStrip>`** — replaces 3 tab implementations
- **`<StatusDot>`** — replaces 2 ad-hoc status indicators

---

## 8. Severity table

Quick-scan for prioritization. Severity scale:
**P0** = looks broken / structurally wrong.
**P1** = visibly off / interaction lifeless.
**P2** = polish nit / 5-second fix.

| Sev | Surface | Issue | File:line |
|---|---|---|---|
| P0 | Explore / Settings / Network | Nested sidebars (two left rails) | `explore:406`, `settings:86`, `network:69` |
| P0 | Home | 6+ inline section header markup variants | `page.tsx:265,304,349,443,512,552,627` |
| P0 | All charts | Pure Recharts defaults | `statistics/*Tab.tsx` |
| P0 | All | Dashboard-appropriate keyframe vocabulary unused (6 of 12 keyframes belong here and none are wired) | global |
| P0 | All | No focus-visible rings on most components | global |
| P1 | Explore | Sticky toolbar bleeds cards through | `explore:584` |
| P1 | Settings | Sidebar width hardcoded vs. global w-60 | `settings:86` |
| P1 | All | 12 distinct text-white/N opacity values | global |
| P1 | All | 5 distinct border opacity values | global |
| P1 | All | No active-press feedback on any button | `Button.tsx` |
| P1 | All | Hover states 6%-opacity (invisible on dark) | global |
| P1 | All | Disabled = opacity-50 (lazy) | `Button.tsx` |
| P1 | All | Dialogs/dropdowns appear instantly | `Dialog`, `Select`, `RowMenu`, `AvatarMenu` |
| P1 | Status indicators | `animate-ping` (default) instead of branded `breathe` | `NetworkStatusDot`, `ModelCard` |
| P1 | Inputs | No focus ring; placeholder contrast borderline AA | global |
| P1 | Network | StatCard ≠ home KpiTile ≠ UsageTab inline | three files |
| P1 | Login | Warm color used decoratively (violates brand rule) | `LoginPage:115` |
| P1 | Login | Plain dark, no brand pattern | `LoginPage` |
| P1 | Model detail | "Output" label too faint | `models/[id]:226` |
| P1 | Model detail | Tab strip h-7 desktop / h-9 mobile (shrinks on bigger) | `models/[id]:158` |
| P1 | Sidebar / Footer | No tooltip primitive — uses `title=` | global |
| P1 | All | No toast system | global |
| P1 | All | No skeleton primitive | global |
| P2 | Explore | Inactive histogram bars too faint | `explore:242–260` |
| P2 | Explore | ModelCard hover border 6% bump | `ModelCard:30` |
| P2 | Explore | List row dividers white/[0.04] | `explore:135` |
| P2 | Explore | Filter pill default contrast | `explore:602` |
| P2 | Explore | Empty state icon visibility | `explore:99` |
| P2 | Login | "or" divider on narrow viewports | `LoginPage` |
| P2 | Login | "Popular" pill overflow on tiny screens | `LoginPage` |
| P2 | Login | H1 should be font-bold + text-balance | `LoginPage:152` |
| P2 | Sidebar | Collapsed rail could be w-12 | `DashboardSidebar` |
| P2 | Footer | Mobile legal text white/40 | `DashboardFooter` |
| P2 | All | Motion durations vary across overlays | global |
| P2 | All | Icon sizes drift (12/14/16/20 inconsistent) | global |
| P2 | All | Type scale proliferation (text-[11..15px]) | global |
| P2 | All | tabular-nums missing on KPI values, charts, tables | global |
| P2 | All | Selection / caret browser default | global |
| P2 | All | `<input type="range">` raw default thumb/track | global |
| P2 | All | Scrollbar consistency varies | global |
| P2 | Account | Profile card padding py-3.5 | `AccountTab` |
| P2 | Network | Tab labels case mix (sentence/plural) | `network/page.tsx` |
| P2 | Cmd+K | Opens instantly, generic icons | `DashboardSearch.tsx` |
| P2 | Microcopy | Generic SaaS phrasing | global |

---

## 9. Phased execution plan (mirrors `~/.claude/plans/instead-of-a-horizontal-golden-raccoon.md`)

### Phase 1 — Foundations (M)

Sub-nav rework (kill nested sidebars, defloat sticky toolbars). Semantic tokens (`text-fg-*` matched to brand-tokens.md). Motion vocabulary (durations, easings, brand keyframes wired). Token sweep across dashboard.

### Phase 2 — Primitives polish + missing primitives (L)

Polish existing: Button (active scale, ring focus, shadow lift), Inputs (hover, focus ring, error variant, custom range thumb), Select / dropdowns / menus (entrance animation, keyboard focus distinguish), Dialog / Drawer (entrance animation, focus trap), Tabs (sliding indicator), Cards (hover composition), Badges (unified variants), Status indicators (halo + center).

Build missing: `<Toast>`, `<Tooltip>`, `<Skeleton>`, `<Toggle>`, `<Checkbox>`, `<KpiCard>`, `<CopyButton>`, `<TabStrip>`. Reuse existing `<SectionHeader>`.

### Phase 3 — Surfaces + restrained brand expression (L)

Surface-by-surface refinement using Phase-2 primitives + Phase-1 foundations. Each surface gets one or two distinctive moments — **restrained, dashboard-appropriate moves only.** No `scanLine`, no `glassSpecular`, no `dashFlow`, no liquid-glass — those stay in marketing.

- **Login** (the only crossover surface): faint `tile-bg` (very low opacity), branded green-bright glow (replacing the warm misuse), small corner crosshair as a quiet brand reminder, H1 weight + `text-balance`
- **Home**: `<KpiCard>` for KPIs (tabular-nums, trend arrows), WelcomeCard progress ring `breathe` while incomplete, free-tier progress bar `shimmer` while animating to value
- **Explore**: filter bar + drawer (post Phase 1), branded empty state with character, ModelCard hover earns shadow lift + border + bg in concert (matte cards, no shine)
- **Model detail**: `<TabStrip>` with sliding indicator, Run button subtle `ctaGlow` halo on hover (no click theatrics), `<KeyBadge>` on API tab already there, `<CodeSnippets>` selection branded
- **Usage**: `<KpiCard>` row, Recent Requests log gets typographic discipline (mono timestamps, tabular-nums cost, tiny "live" indicator next to most-recent row when auto-refresh is on), branded chart palette
- **Network**: branded chart styling pass — Recharts custom-styled, branded tooltip, mono axis ticks at `text-fg-label`, `border-hairline` grid lines, mount stagger
- **Settings**: tabs (post Phase 1), tightened padding rhythm, "Advanced" toggle visibility
- **Sidebar**: logo brief one-shot `node-pulse` on initial mount, active-nav indicator subtle `breathe`, footer status `<StatusDot>` with `breathe` halo
- **Footer**: `<Tooltip>` primitive for the status hover, branded `<StatusDot>`

### Phase 4 — Voice + nits (S)

Microcopy pass for brand voice. Long-tail P2 fixes. Final accessibility contrast check.

---

## 10. Open flags

- **Custom icon set** — deferred; would replace Lucide. Out of scope for this plan; Lucide with consistent stroke + size will look polished enough.
- **Real syntax highlighting** — deferred for `<CodeSnippets>`. Mono + branded selection is the floor for now.
- **Design system import** — deferred per stakeholder. This plan establishes tokens that will make the eventual import a re-mapping exercise rather than a redefine.
- **`brand-tokens.md` updates** — once Phase 1 lands, the brand doc should reference the new `--color-fg-*` and motion tokens for future readers.
