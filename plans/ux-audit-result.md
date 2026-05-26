# Livepeer Developer Dashboard — UX Audit & Redesign Plan

> Audit of the current worktree (`claude/dashboard-updates`, forked from `feat/studio`) after the vertical sidebar was introduced.
> Scope: `app/(dashboard)/**` only. Upstream marketing/docs surfaces are treated as opaque entry points.
> North star: **Zain from Flipbook** — ship → viral → needs real-time video inference tonight → must self-serve from landing to production without reading a whitepaper.

---

## 0. Executive summary

The dashboard is a high-fidelity mock with smart bones. The **information architecture is almost right**: an Explore surface for discovery, a model detail page with playground + code, settings split by concern, and a stats surface for the curious. The new sidebar reduces the old header's cognitive load considerably.

The big problems live in three places:

1. **Zain's first-inference path is broken as a *path*.** Each screen works in isolation, but the handoff between them leaks — no bridge from the welcome card to the API key, no "insert my key" in the playground, no confirmation that a free-tier test run is actually free. Zain has to assemble the journey himself.
2. **Protocol vocabulary pollutes the default surfaces.** "Signer", "routing", "orchestrators", "pay-per-inference", "throughput scales with your connected providers" — all appear on home, model detail, and billing before Zain has any context for them. The sidebar is clean, but the page bodies leak.
3. **Empty states teach nothing.** On day one, Usage is empty, Recent Requests is empty, Free tier KPI reads "0% used", and Payments shows a chart with no data. These surfaces exist to reassure Zain that the system is working — instead they look broken.

Fixing these three things — paved first-inference path, aggressive protocol-vocab scrub, teaching empty states — captures ~70% of the value before any visual rework.

---

## 1. Current-state audit

### 1.1 Route map & jobs-to-be-done

| Route | LOC | Job-to-be-done | Audience fit |
|---|---|---|---|
| `/dashboard` | 764 | Welcome back; show what's next; catch up on recent activity | Zain (landing); existing dev (revisit) |
| `/dashboard/login` | ~300 | Sign up or sign in (email, GitHub, Google — all mock) | Zain (entry), existing dev |
| `/dashboard/explore` | 922 | Discover a capability that matches my use case | Zain (first model); existing dev (browse) |
| `/dashboard/models/[id]` | 685 | Understand one model, test it live, copy code for my stack | Zain (first-inference bridge); existing dev (debugging) |
| `/dashboard/settings` | 122 + 4 tabs | Manage account, API tokens, payment, usage (router + shell) | Existing dev primarily |
| `/dashboard/stats` | 107 + 4 tabs | Inspect network-wide health, payments, GPU inventory | Orchestrator op primarily; curious dev |
| `/dashboard/header-qa` | 68 | QA sandbox for auth states | Internal only; should not ship |

### 1.2 Zain's journey, traced through the actual code

| Step | Zain's intent | What the product does | Friction |
|---|---|---|---|
| 0 | "Flipbook just went viral. I need real-time GPU compute." | Lands on `/dashboard` (assumed upstream) | Out of scope; but note: the dashboard never names Zain's moment. Home copy is generic. |
| 1 | "Sign me up fast." | `/dashboard/login`: email or OAuth, instant mock sign-in, redirect to `/dashboard` | Form is fine. "Continue with GitHub" and "Continue with Google" are visually equal — GitHub is the more-likely primary for Zain. `LoginPage.tsx:170,178`. |
| 2 | "What's next?" | Welcome card shows 2/3 checklist. Step 3 is "Make your first inference → /dashboard/explore". `app/(dashboard)/dashboard/page.tsx:128–194` | Card says "Your default key is active. 10,000 free requests per month" (`:169`) but **doesn't link to the key**. Zain has to guess that Settings is where he'll retrieve it. |
| 3 | "Pick a model." | `/dashboard/explore` shows ~50 models, filterable. | No "Recommended for Zain" or "Popular for real-time video" entry point. All models presented flat. Price histogram exists without units/context — is it per request? per minute? `explore/page.tsx:183–303`. |
| 4 | "Test it." | Model detail → Playground tab → Run button → mock inference with 0.3–1.8s simulated latency | Playground runs **without any cost disclosure**. Zain can't tell if this counts against his 10k free requests. There is no "this test run is free" message. `models/[id]/page.tsx:47–242`. |
| 5 | "Get the code." | API tab shows curl/Python/Node/HTTP. Shows `Authorization: Bearer YOUR_API_KEY` | **No link to retrieve his actual key.** Zain has to navigate to Settings → API Tokens, copy, and paste back. This is the single highest-friction handoff in the product. `models/[id]/page.tsx:247–293`. |
| 6 | "Where's my key?" | Settings → API Tokens tab. An "Auto" token exists by default. Copy button. | Key is masked as `prefix•••••••` — Zain sees the prefix but the clipboard also writes the mask, so what he pastes is **the masked string, not a real key**. `ApiKeysTab.tsx:98–100,212–215`. This works for a mock but will confuse when the real backend lands unless the masking pattern changes. |
| 7 | "Paste and run." | `curl -X POST https://gateway.livepeer.org/v1/... -H "Authorization: Bearer $KEY"` | "gateway.livepeer.org" — the word "gateway" is protocol vocab that's been abstracted away from docs elsewhere, but is visible here. `CodeSnippets.tsx` default endpoint. Not a blocker, but worth noting. |
| 8 | "It worked. Now scale." | No clear "next step" on success. No billing nudge. No "connect a payment provider for production volume" prompt. | Zain has to discover Settings → Billing on his own. Home's welcome card will drop to 0/0 once the inference step is marked done, and there is no follow-on CTA. |

**Where Zain gets stuck (ordered by severity):**
1. Step 5 → 6 handoff (get the key)
2. Step 4 (is this test run free?)
3. Step 8 (what's the post-first-inference path?)
4. Step 3 (which model should I pick?)

### 1.3 Protocol/tokenomics leaks — on-page inventory

A builder on day one should never need to understand: LPT, staking, orchestrator, signer, routing, inflation, delegation, gateway, subgraph, node. Here's where that vocabulary leaks today on default surfaces:

| File:line | Surface | Leak |
|---|---|---|
| `app/(dashboard)/dashboard/page.tsx:627,675,689` | `/dashboard` home | "Request routing by signer", "active signers", "Routing this month" — all above-the-fold for signed-in users. |
| `components/dashboard/settings/PaymentTab.tsx:138,280` | `/settings?tab=billing` | "Your API token routes to it automatically.", "Pay orchestrators directly on-chain. Bypasses signers entirely." |
| `components/dashboard/settings/PaymentTab.tsx:266` | `/settings?tab=billing` | "Implement the OAuth2 spec to route your own billing." (for BYO signer row) |
| `components/dashboard/settings/ApiKeysTab.tsx:17–38` | `/settings?tab=tokens` | Scope select dropdown exposes "Free tier", "Paymthouse", "Livepeer Cloud", "ETH wallet" — payment-routing targets Zain doesn't need on day one. |
| `app/(dashboard)/dashboard/models/[id]/page.tsx:281–282` | Model detail → API tab | "Pay-per-inference. Throughput scales with your connected providers." |
| `app/(dashboard)/dashboard/models/[id]/page.tsx:663` | Model detail hero | "{model.orchestrators} GPUs" — user-friendly framing, but the variable name itself (`orchestrators`) indicates the source layer |
| `components/dashboard/stats/ModelAnalytics.tsx:68–71,220,229` | Model detail → Stats tab | "Orchestrators" KPI card, "Orchestrators serving {model}, ranked by traffic share" |
| `components/dashboard/statistics/PaymentsTab.tsx:94,115,195+` | `/stats?tab=payments` | "ETH fees flowing through the network for completed inference jobs, paid to orchestrators." |
| `components/dashboard/statistics/UtilizationTab.tsx:165,256,286` | `/stats?tab=utilization` | "warmOrchestrators", "X warm / Y total" orchestrators per pipeline |
| `components/dashboard/playground/CodeSnippets.tsx:17` | Model detail → API tab (code) | Default base URL `https://gateway.livepeer.org/v1` |

**What's NOT leaking (good):** LPT, staking, delegation, inflation, transcoder, validator, subgraph, minting — none appear in the dashboard. The line is being held at the protocol/L1 layer. The leaks are all at the "signer/orchestrator/routing" layer, which is harder because it's entangled with billing.

### 1.4 Global chrome — quick assessment

- **`DashboardSidebar`** (just shipped) — Clean. Holds up. The three nav items (Home / Explore / Stats) plus Docs + Auth are the right minimum. Collapse-to-icon-rail is a nice Aave touch.
- **`DashboardFooter`** — "All services online" + 47 orchestrators, 312 GPUs tooltip. Orchestrators leak into the footer tooltip. Otherwise fine.
- **`DashboardSearch` (Cmd+K)** — Solid primitive. Two concrete bugs: the `/dashboard/keys` link in `SUGGESTIONS` and `ALL_RESULTS` does not exist — confirmed by `Glob` against `app/(dashboard)/dashboard/keys/**`. Should point to `/dashboard/settings?tab=tokens`. `DashboardSearch.tsx:22,42`.
- **`AuthContext`** — Fully mocked, localStorage-backed. Fine for this phase.
- **`/dashboard/header-qa`** — Dev sandbox. Shipping this route to production is a footgun — it's discoverable via sitemap and will embarrass us. Should be gated behind NODE_ENV or removed before launch.

---

## 2. Problem inventory — prioritized

Severity legend: **P0** = blocks Zain from first inference. **P1** = materially slows or confuses him. **P2** = polish / existing-dev concerns.

Audience legend: **Z** = Zain (new builder). **D** = existing dev. **O** = orchestrator op.

### 2.1 Onboarding / first-run

| ID | Severity | Hurts | Finding | Cost of leaving it |
|---|---|---|---|---|
| ON-1 | **P0** | Z | No link from Welcome card Step 2 ("API key ready") to the actual key in Settings. `dashboard/page.tsx:165–175` | Zain hunts for the key; 30–60s of avoidable confusion on his most impatient moment. |
| ON-2 | **P0** | Z | No "insert my API key" on the model detail API tab. Shows `Bearer YOUR_API_KEY` placeholder only. `models/[id]/page.tsx:247–293`, `CodeSnippets.tsx:40–43` | Context switch to Settings and back; breaks the copy-paste-run flow. |
| ON-3 | **P0** | Z | Playground "Run" offers no cost/quota disclosure. Zain doesn't know if clicking Run burns his free tier. `models/[id]/page.tsx:211` | Hesitation to test; may skip the playground entirely and copy code blind. |
| ON-4 | **P1** | Z | After step 3 completes ("Make your first inference"), there is no follow-on guidance on home. `dashboard/page.tsx:128–255` | Zain hits the ceiling of the free tier with no path to scale. Churn risk at the exact moment of highest conviction. |
| ON-5 | **P1** | Z | Usage tab, Recent Requests, Free tier progress all read empty or 0% on day one with no teaching state. `UsageTab.tsx:214, 492–649`, `dashboard/page.tsx:647–652` | Dashboard feels broken. Trust cost. |
| ON-6 | **P1** | Z | Explore page opens flat — no "Recommended for real-time video" or "Popular this week" entry point. ~50 models with no editorial guidance. `explore/page.tsx` | Decision paralysis at step 3 of the journey. |
| ON-7 | **P1** | Z | Payment providers section lists 5 options with no "pick this first" guidance. `PaymentTab.tsx:143–274` | When Zain hits quota and needs paid capacity, he freezes. |
| ON-8 | **P2** | Z | "Continue with GitHub" and "Continue with Google" styled identically. GitHub is the more-likely primary for Zain's cohort. `LoginPage.tsx:170,178` | Minor; a slight preference nudge would speed signup. |

### 2.2 Information architecture / navigation

| ID | Severity | Hurts | Finding | Cost of leaving it |
|---|---|---|---|---|
| IA-1 | **P1** | Z | `/dashboard` home shows "Request routing by signer" bar chart + "active signers" KPI above the fold. `dashboard/page.tsx:609–728` | Zain's first impression is four words of protocol jargon. |
| IA-2 | **P1** | Z,D | `/dashboard/stats` appears in primary nav equal to Home/Explore, but content is network-monitoring aimed at orchestrator ops. | Zain clicks "Stats" thinking it's *his* stats, lands on network-wide payment flows. Retreats confused. |
| IA-3 | **P1** | Z,D | API keys scope dropdown exposes payment-routing concepts up front. `ApiKeysTab.tsx:17–38` | On first visit Zain picks "Any provider" with no idea what that means; or picks wrong and breaks his requests. |
| IA-4 | **P2** | D | `/dashboard/header-qa` is shipped as a real route in `app/(dashboard)/dashboard/header-qa/page.tsx`. | Leaks to the sitemap in prod; embarrassment risk. |
| IA-5 | **P2** | Z,D | `DashboardSearch` suggests "Get your API key → /dashboard/keys" — route doesn't exist. `DashboardSearch.tsx:22,42` | Dead-end 404 from a prominent surface. |
| IA-6 | **P2** | Z,D | No breadcrumb or page title inside content areas; the old header had one, new sidebar doesn't. Some pages have their own `<h1>` but nested routes (e.g. `/dashboard/models/daydream-video`) don't show "Explore / Daydream" context. | Lost orientation on deep routes. Browser back button becomes the only escape. |
| IA-7 | **P2** | D,O | Stats payments/utilization/gpus tabs are all mixed together under one surface; usage (Zain's own numbers) lives under Settings. | Two different mental models for "numbers": "your numbers" vs "network numbers". The current split is correct but the surface naming doesn't reflect it. |

### 2.3 Data density & clarity

| ID | Severity | Hurts | Finding | Cost of leaving it |
|---|---|---|---|---|
| DC-1 | **P1** | Z,D | Free tier KPI says "Free tier (0% used)" on day one. Numeric-only at `dashboard/page.tsx:642–644`. No "10,000 requests included" framing. | Zain doesn't know how much runway he has. |
| DC-2 | **P1** | Z,D | Price histogram on `/explore` has no units. $0.000–$X.XXX with no "per request" or "per second". `explore/page.tsx:183–303` | Can't compare models on cost. |
| DC-3 | **P1** | Z,D | Playground `PlaygroundOutput` shows "inference time" but not cost, not latency percentile, not model version. Missing context on first success moment. | Zain can't benchmark or screenshot meaningful numbers. |
| DC-4 | **P2** | D | Usage charts use `generateMockUsageData()` with randomized series — means on day one the chart looks populated (false signal) until real backend ships. `lib/dashboard/utils.ts` | Trust cost once real data lands and patterns don't match what Zain saw before. |
| DC-5 | **P2** | D | Recent Requests "refresh every 30s" (`UsageTab.tsx:101`) with no loading state on poll. Chart re-renders can feel jumpy. | Perceived instability. |
| DC-6 | **P2** | D | Mobile Recent Requests card layout has no sticky column header. Scroll and you lose what each field means. `UsageTab.tsx:545–567` | Mobile debugging is harder than desktop. |

### 2.4 Visual polish / design quality

| ID | Severity | Hurts | Finding | Cost of leaving it |
|---|---|---|---|---|
| VP-1 | **P1** | Z,D | Home Welcome card: "Make your first inference" (Step 3, primary) and "Connect a payment provider" (optional, separated) use identical link + arrow styling. `dashboard/page.tsx:179–193, 197–220` | Primary CTA doesn't dominate. |
| VP-2 | **P1** | Z,D | Model detail hero wraps `{provider} / {model name}` on one flex line. Long names break to a half-word on narrow viewports. `models/[id]/page.tsx:512–551` | Unprofessional on mobile. |
| VP-3 | **P2** | Z,D | Model detail metadata pills (Warm/Cold, Realtime, Category, runs, latency, GPUs, price) all live in one flex-wrap block and become a dense slab on mobile. `models/[id]/page.tsx:555–605` | Mobile users skim past the useful signal. |
| VP-4 | **P2** | D | "Copied" feedback on copy buttons is text-swap only. No icon change, no transient color flash. Multiple places: `CodeSnippets.tsx:159–169`, `ApiKeysTab.tsx:212–215`. | Easy to miss; user re-clicks and wonders. |
| VP-5 | **P2** | D | Settings AccountTab OAuth profile view vs. email-user profile view have different layouts (`AccountTab.tsx:169–201` vs the flow below). Inconsistent chrome for the same job. | Minor; but accrues. |
| VP-6 | **P2** | D | Payment provider rows on mobile: "Coming soon" badge only shows on desktop. Mobile shows a disabled "Connect" with no explanation. `PaymentTab.tsx:164–167,211–213` | Dead click on mobile. |
| VP-7 | **P2** | D | Delete account confirmation is a single red button with no typed-phrase confirmation. `AccountTab.tsx:348–395` | Recoverable error probability non-zero for a non-recoverable action. |

### 2.5 Copy / voice

| ID | Severity | Hurts | Finding | Cost of leaving it |
|---|---|---|---|---|
| CP-1 | **P1** | Z | "Pay-per-inference. Throughput scales with your connected providers." — jargon. `models/[id]/page.tsx:281–282` | Zain doesn't parse it on first read. |
| CP-2 | **P1** | Z | "Your API token routes to it automatically." on the billing page. `PaymentTab.tsx:138` | Passive + protocol vocab. |
| CP-3 | **P1** | Z | "Each connected provider gets a default token automatically." on the tokens page. `ApiKeysTab.tsx:124` | Inverts the right mental model — tokens come first, providers route traffic. |
| CP-4 | **P2** | Z | ApiKeys scope description: "Community provider only. Rate-limited." — doesn't say the actual rate limit. `ApiKeysTab.tsx:21` | Opacity on a number Zain needs. |
| CP-5 | **P2** | D,O | Stats tab page descriptions are accurate but builder-agnostic. "ETH fees flowing through the network for completed inference jobs, paid to orchestrators." `PaymentsTab.tsx:94` | Content is fine for an orchestrator op; out of place as a default tab for a builder. |

---

## 3. Redesign proposal

### 3.1 Design principles

These are the guardrails every ticket should be evaluated against:

1. **Real-time metrics are first-class.** The builder audience cares about latency, availability, and uptime more than aesthetic. KPIs earn top-of-viewport real estate on every surface that has them. Numbers have units. Numbers have context ("p95 latency" not "latency"). Numbers have comparison baselines when honest ones exist.
2. **Tokenomics, signers, and orchestrators never appear in the default builder view.** Payment routing is a billing implementation detail — surface it only inside billing, and only when the user has opted in by connecting a second provider. Everything Zain sees on Home, Explore, one Model, and Tokens must be free of protocol vocabulary. "Network health" exists but is labeled as such and is not in the primary sidebar.
3. **Every empty state teaches.** No empty chart. No "0 requests." Empty states take three forms depending on context: (a) a guided CTA to the next action, (b) an annotated example showing what data will look like, or (c) a small educational block explaining the concept. Never just "nothing here."
4. **The first-inference path is paved.** From `/dashboard` → first real API response in 4 clicks max, with zero copy-paste-hunting between tabs. If a screen sits on that path, it must either drive forward or get out of the way.
5. **One price unit. One success metric. One primary action per surface.** If a page has two primary CTAs of equal weight, one of them is wrong. If a price is shown, its unit is shown. If a latency is shown, its percentile is shown.
6. **The dashboard respects the network's honesty.** ~100 AI-capable GPUs. 90–95% uptime. No formal SLAs. Don't fake abundance with filler mock data. Do show the real numbers as they come online.

### 3.2 Proposed IA

**Primary sidebar (unchanged from current):**
- Home
- Explore
- Usage *(new name — replaces the previous role of "Stats". This is the builder's stats.)*
- Docs (external)

**Secondary / collapsed group (promoted to sidebar only when account-connected, or tucked behind an overflow menu):**
- Billing (was `/settings?tab=billing`)
- Tokens (was `/settings?tab=tokens`)
- Account (was `/settings?tab=account`)

**Removed from primary nav:**
- **"Stats" (network monitoring)** → move to `/network` or `/dashboard/network`, link from footer "All services online" tooltip. Keep the page; demote the entry point. Orchestrator ops know to look for it; Zain never trips over it.

**Removed entirely:**
- `/dashboard/header-qa` — gate behind `NODE_ENV !== "production"` or delete outright.

**What the sidebar looks like by audience:**
- **Anonymous**: Home, Explore, Docs. Avatar area shows Sign in / Sign up.
- **Signed in (new, <1 month)**: Home, Explore, Usage, Docs. Billing/Tokens/Account live under the avatar menu (where they are now). Network link in the footer only.
- **Signed in (established)**: Same. No progressive disclosure needed — the established dev learns the sidebar once.
- **Orchestrator op**: Same primary sidebar. `/network` is reachable from the footer and from "All services online" in the footer status dot. We don't build an op-specific surface in this pass.

### 3.3 Key screen concepts

#### 3.3.1 `/dashboard` — hero dashboard (new first-time + returning states)

**First-time state ("no inferences yet"):**
- **Hero block (full width, above the fold):**
  - H1: "Welcome, {firstName}. Let's run your first inference."
  - Progress ring (1/3 — only the inference step is open; account + key are silent, not listed as completed todos because that's patronizing)
  - Single primary CTA: "Run a model" → jumps directly to Explore with a `?suggested=1` hint that surfaces a curated pick (Daydream for real-time video, or whichever model we want to hero this quarter).
  - Secondary, muted text link below: "I already have my key — show me code" → goes straight to a "code first" view on a chosen default model.
- **Below-the-fold:**
  - "Your API key" card: shows prefix + masked suffix, Copy button that actually copies a working key, "Manage keys" link to the tokens page. This is the single place to close the ON-1 friction.
  - "What's on the network" strip: 3–4 tile cards of popular capabilities, labeled "Real-time video", "Speech", "Language", etc. Each tile links into Explore with a category filter applied.
  - "Your free tier" block: shows "10,000 requests included this month" prominently, with "0 used so far" secondary. On day one this reassures; once there's usage, the 0 becomes the actual number.

**Returning state ("inferences exist"):**
- **Hero block:** "Good to see you, {firstName}." Single KPI row (requests today, p95 latency today, cost this month). No progress ring.
- **Recent activity stream:** 10 most recent requests with status/latency/cost. Click-through to Usage tab for drill-down.
- **"Still free tier?" prompt:** If the user is >60% through the free tier allowance, show a one-line "You're at 7,324 / 10,000 requests. [Connect a provider] to scale without limits." Otherwise hidden.
- **Remove from the default surface:** the "Request routing by signer" chart (currently `dashboard/page.tsx:609–728`). Move it to `/usage` where routing breakdown makes sense for a user who has multiple providers connected.

**Data to surface here:**
- Requests this month (with free tier allowance framing on day one)
- p95 latency of the user's requests
- Cost this month (or "Free tier" badge if all requests are within allowance)
- Recent activity (10 rows)
- What the network can do (3–4 category tiles)

**Data to remove from here:**
- Any mention of signers, routing, orchestrators
- The pre-connected providers bar chart (irrelevant if the user has only the free tier)

#### 3.3.2 `/dashboard/explore` — capability discovery

**Keep:**
- The filter sidebar IA
- The grid/list view toggle
- The empty state that links to docs

**Change:**
- **Add a "For you" top strip** that surfaces 3–4 curated picks the first time a user lands. The curation can be as simple as "starred by the team" or hardcoded for now. It disappears after the user interacts with filters.
- **Price histogram gets units.** Replace $0.000–$X.XXX with "$/request" or "$/minute" explicit labels on the axis endpoints. If different models have different units, normalize to "per inference" in the filter, and show the underlying unit on the model card.
- **Realtime filter gets a one-line explanation inline** when hovered or when empty: "Models that support WebRTC streaming inference (real-time video)."
- **Model cards show one KPI badge, not five.** Pick one: availability (Warm/Cold) on the card, with the rest (runs, latency, GPUs, price) inside the detail page. Reduces cognitive load in the grid.

#### 3.3.3 `/dashboard/models/[id]` — model detail + playground + code

**Keep:**
- The tabbed structure (Playground / API / README / Stats)
- Dynamic playground form based on `model.playgroundConfig.fields`
- CodeSnippets language tabs (curl / Python / Node / HTTP)

**Change:**
- **Playground Run button gets a cost tag.** "Run (free tier)" when the user has quota. "Run (0.003 USD)" once they're on paid. Removes the guess from ON-3.
- **API tab shows the user's actual key.** Replace `Bearer YOUR_API_KEY` with the user's prefix + masked suffix, with a one-click "Copy full key" button (when a real backend exists). Until then, the mock can show `Bearer lp_live_••••••••••••` with a "Copy" that copies a working mock string. Single biggest win for ON-2.
- **Post-success state on Playground output.** When an inference completes, show: inference time, cost (or "free tier"), and a persistent "Copy code for this run" button that generates a curl with the exact inputs the user tried. This is the handoff from click-to-run to production code — and today it doesn't exist as a moment.
- **Remove the Stats tab from the default tab strip.** Not Zain's priority. Keep the route, demote it to an "Advanced" expand or move to the Network page.
- **Hero metadata on mobile**: stack provider / model name vertically; hide the secondary metadata pills behind a "Show details" expand. VP-2, VP-3.

#### 3.3.4 `/dashboard/usage` (renamed from `/settings?tab=usage`, promoted to primary nav)

**Keep:**
- Filter bar (provider, token, period)
- Stacked bar chart by provider
- Recent requests log with auto-refresh
- Mobile card layout for recent requests

**Change:**
- **Rename tab labels away from protocol vocab.** "Provider" stays. "Token" stays. Remove any "signer" references from column headers and axes — the mock data already uses "freeTier / paymthouse / livepeerCloud / ethWallet" which are fine as-is; just don't call them "signers" in UI chrome.
- **Empty state teaches.** On day one show a skeleton of what the chart *will* look like, annotated with "This chart fills in once you make requests. [Run your first model]."
- **KPI cards gain context.** "Requests this period" → "Requests this period (vs. last period)" with trend arrow. Existing ground truth for this lives in mock data already.
- **Free tier card on this page shows the allowance prominently.** "10,000 included → 7,324 used → 2,676 remaining, resets in 12d". Replaces the current naked % bar.

#### 3.3.5 `/dashboard/settings` — account / tokens / billing

**Keep:**
- Three-way tabs: Account, Tokens, Billing
- The existing tab content structures

**Change:**
- **Tokens page: hide scope select on first visit.** The default "Auto" token works for all providers. Show the scope select inside an "Advanced" expand. Collapses IA-3 for 90% of users.
- **Tokens page: info banner becomes actionable.** "The free tier gives you 10,000 requests/month. [Connect a provider] for more." Sticks to the top. (CP-4 adjacent.)
- **Billing page: add a "Recommended for you" hint.** Small badge on Livepeer Cloud ("Start here for fiat billing") or Paymthouse ("Start here for community / crypto"). Removes the cold-start paralysis ON-7.
- **Billing page: strip protocol vocab.** Replace "Your API token routes to it automatically" with "Your API key uses this provider for paid inference." Replace "Pay orchestrators directly on-chain" with "Advanced: pay from your wallet directly, bypassing our billing." CP-1, CP-2, CP-3.
- **Account page: OAuth and email profile layouts converge.** Single summary card at top, edit affordances below, regardless of auth provider.
- **Account page: delete confirmation requires typing the email.** VP-7.

#### 3.3.6 `/dashboard/network` (was `/dashboard/stats`)

- Same four tabs, renamed surface. Remove from primary sidebar; reach it from footer "All services online" link and from a "View network health" link on Home (returning users only).
- Add a one-line description at the top of each tab, framed for orchestrator-curious builders rather than assuming protocol fluency.
- Accept the leaked vocabulary here. "Orchestrators" is the right word at this depth. The audience for this page has earned it.

### 3.4 Component/system changes

**New shared components:**
- `<KeyBadge>` — unified "prefix + masked suffix + copy" affordance, used on `/dashboard` home, the model detail API tab, and the tokens page. Single source of truth for how we render an API key.
- `<CostTag>` — unified "free tier" / "$0.003" / "mock" affordance for the Playground Run button and any per-request cost rendering.
- `<EmptyState>` variants — `guided` (CTA), `annotated` (skeleton + label), `teach` (educational). Replace the handful of one-off empty messages across Usage, Recent Requests, Playground output pre-run.
- `<KpiCard>` already implied by existing code patterns — formalize it with a `trend?` prop and a `unit` prop.

**Deprecations / removals:**
- `/dashboard/header-qa` — delete or env-gate.
- `DashboardSearch` `ALL_RESULTS` and `SUGGESTIONS` — fix the `/dashboard/keys` links, sweep all entries for accuracy.
- Any `signer` / `routing` mention in chrome outside of Billing and Network.

**Design tokens:**
- Add `surface-teach` (muted blue-green for empty-state teaching moments) to differentiate from `surface-raised` (interactive).
- Audit green accents: `green-bright` used consistently for active/positive; `green` used for primary CTAs. No changes, but codify the rule in `brand-tokens.md`.

---

## 4. Execution plan

Phased by maximum impact on Zain's journey. Each phase is a ship-able chunk; phases later than 1 depend only on what's in earlier phases unless noted.

### Phase 1 — "Paved first-inference path" (**S–M**)

Objective: cut Zain's time-to-first-inference by ~50% and remove the three P0 blockers.

| Work | Size | Notes |
|---|---|---|
| Welcome card Step 2 links to `/settings?tab=tokens` | XS | One-line fix. `dashboard/page.tsx:165–175` |
| Model detail API tab renders the user's real (mock) key via new `<KeyBadge>` | S | New shared component. Replace `Bearer YOUR_API_KEY` with prefix + masked suffix + Copy. |
| Playground Run button gets `<CostTag>` | XS | Reads free-tier state, shows "(free tier)" or cost string. |
| `DashboardSearch` broken link fix + sweep | XS | Change `/dashboard/keys` → `/dashboard/settings?tab=tokens` in both arrays. |
| Strip `signer` / `routing` vocab from home (`dashboard/page.tsx:609–728`) — move the chart to Usage | S | Move, don't delete. |
| Strip protocol vocab from Billing copy (CP-1, CP-2, CP-3, CP-4) | XS | Copy-only. |
| Tokens page: collapse scope select into "Advanced" expand by default | XS | Toggle default state. |

**Dependencies:** none. All frontend-only; no backend changes.
**Definition of done:** Zain can go landing → Run → copy working code with his key, in under 90s on desktop, without changing tabs outside Home → Explore → one Model.

### Phase 2 — "Teaching empty states + clarity pass" (**M**)

Objective: Usage, Recent Requests, Free tier quota, and Playground output each have states that teach on day one.

| Work | Size | Notes |
|---|---|---|
| `<EmptyState>` component with 3 variants (guided / annotated / teach) | S | Design system primitive. |
| Usage page: Free tier KPI reframed with allowance + remaining + reset | S | DC-1. |
| Usage page: day-one annotated chart skeleton | S | Replace `generateMockUsageData()` for empty state. |
| Recent Requests: empty-state with "make a request" CTA | XS | |
| Playground output post-success state ("Copy code for this run") | M | New action, ties Playground → production code for the first time. |
| Explore price histogram: units on axis + card | S | DC-2. |
| Model card KPI reduction — one badge only on grid | S | VP-3 adjacent. |
| Hero metadata on mobile model detail: stack + hide | S | VP-2, VP-3. |

**Dependencies:** Phase 1 (`<CostTag>` exists).
**Definition of done:** No surface shows 0 / empty / $0.000 without explanation. Model cards don't look like data dashboards.

### Phase 3 — "IA cleanup + sidebar for signed-in vs. anon" (**M**)

Objective: demote network stats, gate the QA sandbox, fix the returning-user home experience.

| Work | Size | Notes |
|---|---|---|
| Rename `/dashboard/stats` → `/dashboard/network`; remove from primary sidebar; add footer + home link | M | Route rename + nav rewiring. |
| Rename Usage from `/settings?tab=usage` → `/dashboard/usage` promoted to primary sidebar | M | Mutually exclusive with the Stats rename — coordinate routes. |
| Home returning-user state | M | New branching in `app/(dashboard)/dashboard/page.tsx`. |
| Gate `/dashboard/header-qa` behind `NODE_ENV` or delete | XS | IA-4. |
| Breadcrumb / page title primitive for deep routes | S | IA-6. |

**Dependencies:** Phase 1 (sidebar structure is stable). Routing changes touch navigation constants in `lib/constants.ts`.
**Definition of done:** A signed-in returning user sees their own numbers on Home, not onboarding. Network stats exist but are not in the default nav. `header-qa` is not reachable in prod.

### Phase 4 — "Polish pass" (**S**)

Objective: consistency, a11y, minor friction removals. Ship in a single sprint-worth of parallel polish work.

| Work | Size |
|---|---|
| Copied-button feedback: icon swap + transient color flash (everywhere) | S |
| Account tab OAuth/email layout convergence | S |
| Payment provider "Coming soon" badge mobile parity | XS |
| Delete account: typed-email confirmation | XS |
| LoginPage: subtle primacy on GitHub OAuth | XS |
| Mobile Recent Requests: floating column legend | S |

**Dependencies:** none.
**Definition of done:** the nits in §2.4 and §2.5 are closed. No new features.

### Phase 5 — "Real data when it lands" (**L** — blocked)

Objective: swap mock data for real. Requires backend work (API key provisioning, usage ingestion, payment provider status). Scoped separately; flagged here as the natural next milestone.

| Work | Size | Blocker |
|---|---|---|
| `AuthContext` → real OAuth + session | L | Backend auth service |
| `lib/dashboard/mock-data` → real endpoints | L | Dashboard API |
| Usage polling → real metrics | M | Usage ingest pipeline |
| Payment providers: real connect flows | L | Billing integration |

**Do not ship Phase 5 piecemeal.** The dashboard's honesty depends on real data being real across the board — half-real, half-mock is worse than all-mock.

---

## 5. Open flags for Rick / stakeholders

Carried over from `CLAUDE.md` and surfaced during this audit; these affect copy choices inside the dashboard:

- **Free tier allowance of 10,000 requests/month**: the dashboard states this in several places (`dashboard/page.tsx:169`, mock data). Is this the real number we'll ship with? If not, do not hard-code.
- **Price units**: every model's `networkPrice` and `pricing` in `lib/dashboard/mock-data.ts` has a unit (`Minute`, etc.). Is "per minute" the real canonical unit for real-time video pricing, or will it be per second / per request for most of the catalog?
- **Realtime filter semantics**: audit assumed "realtime = WebRTC streaming inference." Confirm the model-level field is authoritative on the backend side.
- **Gateway endpoint naming**: `gateway.livepeer.org` appears in code snippets. Is the developer-facing endpoint going to stay that subdomain, or is there a plan to rename away from "gateway" terminology?
- **Orchestrator count in footer**: "47 orchestrators, 312 GPUs active" is mock data. Real counts should come from the network stats pipeline; until then, flag the mock.

---

## 6. Out of scope (intentionally deferred)

- Marketing site, docs, Discord flow — per the "strict /dashboard" scope.
- Mobile-first redesign. Current dashboard is desktop-primary, responsive-as-enhancement. Zain's first action is likely on his laptop; mobile polish is a Phase 4+ concern.
- Dark/light theme. Dashboard is dark-only, which matches the brand and is not a concern in this pass.
- Internationalization. English-only for now.
- Real-time collaboration features (team accounts, shared tokens). Orthogonal.
