# Early access build ledger

## Status

Dependency: PR46, commit44aa3a9. Integration branch:
`codex/early-access-foundation`. Production unchanged. Delivery boundary:
reviewed stacked PR + isolated preview + migration dry run, not production.

## Wave 0 — discovery

| Owner             | Findings                                                                                                                         | Status              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| data_owner        | Issuer absent; schema monolithic; consent projections; preserve multiple external IDs; app-scoped inventory has no Auth0 subject | Complete, read-only |
| identity_engineer | Email-only cross-provider joining unsafe; external ID regenerated; session/API/MCP boundaries need shared approval               | Complete, read-only |
| qa_foundation     | Existing tests encode old fail-open product policy; no general CI; disposable DB guard missing; key exchange/refresh bypasses    | Complete, read-only |

## Contract freeze v1

See architecture.md and lib/platform/contracts.ts. Single migration author:
data_owner. Shared interfaces and amendments: coordinator only. No subagent may
read env files, credentials, remote service data, or run credentialed commands.
Worktrees are edit isolation, not a credential security boundary.

## Wave 1 — assignments

| Owner             | Worktree                  | Exclusive ownership                                                                                     | State    |
| ----------------- | ------------------------- | ------------------------------------------------------------------------------------------------------- | -------- |
| data_owner        | .agent-worktrees/data     | lib/db/schema.ts, lib/db/schema/**, drizzle/**, scripts/early-access/\**, lib/db/*migration*test*       | Assigned |
| identity_engineer | .agent-worktrees/identity | lib/authentication/**, lib/external-accounts/**, lib/identity/\*\* except session-compatibility.test.ts | Assigned |
| qa_foundation     | .agent-worktrees/qa       | tests/support/**, tests/contracts/**, lib/platform/_test_                                               | Assigned |
| coordinator       | integration               | shared contracts, ledger, package/config/CI, integration and remote operations                          | Active   |

Implementers must report base commit, changed files, exact test commands/results,
unresolved risks and handoff commit. Root commits/integrates worktree patches;
agents do not mutate git history or install dependencies. Independent reviewers
will not be authors of the reviewed subsystem. Findings invalidate affected
signoffs until fixed and rerun against the new commit.

## Integration evidence — foundation in progress

- `fe986b7`: schema module foundation (data owner).
- `932b32f`, `73def06`: disposable-database marker, fixture harness and legacy
  waitlist suite guard (QA foundation).
- `7f8c431`: provider adapter, scoped identity resolution, persisted external
  accounts (identity owner).
- Coordinator contract amendment 1: approval-protected browser profile;
  eliminate client-side Auth0-subject billing-ID derivation.
- Coordinator local `mise exec -- pnpm test`: 104 passed, 19 database tests
  skipped pending credentialed migration gate. This is not preview evidence.
- New preview: `br-holy-sound-auugm104`, schema-only, zero signups.
- Disposable tests: `br-super-bird-auln2med`, child of that empty preview, zero
  signups. Neon schema-only root quota prevented a second schema-only root;
  using the empty preview parent copies no production contacts.
- Both new branches verified against deployed 0004 shape, journal initialized
  for the schema-only clone, dependency migrations 0005/0006 applied. Test marker
  exists only in disposable branch. Original shared preview unchanged.

Current status: foundation implemented; unit-tested; migration/identity DB tests
pending. Product behavior, independent review and preview verification pending.
No production readiness claim. Production inventory credentials/evidence still
need reconciliation; local Console configuration lacks the M2M secret and the
expected M5 Console project is absent. Do not infer production users from the
Auth0 tenant or preview accounts.

## Wave 1 gate passed; Wave 2 assignments

- Migration/planning tests: 10/10 pass on marked disposable Postgres; includes
  upgrade from 0004, repeated backfills and synthetic grandfather reconciliation.
- Identity DB tests: 16/16 pass after `fedaa4f` corrected a fixture that attempted
  to mutate immutable billing mappings. No weakening of the database constraint.
- Existing Console/MCP suite: 85/85 pass. Root lint and typecheck pass.
- These are foundation results, not final admission/security signoff.

Wave 2 base: `fedaa4f`. All specialists read frozen ADR/contracts before edits.

| Owner          | Worktree                | Ownership                                                                                                                                            | Handoff     |
| -------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| access_backend | .agent-worktrees/access | access services except page.ts; admin/subscription/email domains; session-user; access/admin/profile/enrollment/consent routes; legacy session tests | In progress |
| admin_ui       | .agent-worktrees/ui     | admin page/components; waiting screen; explicit protected page wrappers; access/page.ts; AuthContext; UI contract tests                              | In progress |
| mcp_security   | .agent-worktrees/mcp    | MCP modules/callback/token; key exchange; device approval; internal mint; BFF error mapping; MCP contract tests                                      | In progress |

Coordinator owns configuration, environment validation, credentials, Git/CI,
integration, preview provisioning and release evidence. Shared signature amendment:
AccessError has status/code; approved resolvers return AccessDecision including
canonical userId. Specialists may not add alternate authorization policy.

## Independent audit — changes required, fixes in progress

- Data reviewer at `4d2c919`: P1 conflicting billing binding in grandfather
  reconciliation; P2 unaudited signup-grant activation. Author fixed both in
  `2874df8`; root reran migration/planning DB suite 10/10 including the new
  regressions. Independent re-review still required.
- Security reviewer at `4d2c919`: SEC-01 high, inherited authorization-code
  replay. Data owner added 0008 receipt table in `2874df8`; coordinator implements
  consumption without changing wire format. Original MCP-author recall and a
  replacement spawn both hit runtime thread-limit errors; ownership explicitly
  reassigned to coordinator, not the reviewer.
- SEC-02 medium: inherited reusable, unbound refresh credentials. Compatibility
  disposition requested from user; not silently accepted or declared fixed.
- Backend self-review found stale newsletter retry risk. Author added shared
  consent/delivery locking and current-state reread in `dbcbdc5`.
- UI `0d759e3`: 22 local tests; MCP `4d2c919`: 48 local tests. Root integrated
  UI/security/config contract run:115 tests passed. These do not substitute for
  live staging issuer or protected preview evidence.
- Read-only staging discovery/JWKS:200, advertised issuer matches staging,
  one RS256 key. Actual user-token claim compatibility remains preview verification.

## Reviewed code checkpoint and preview publication

Code checkpoint: `48b45dda5dab9d0c417933b00b2c0859d7adb969`.
Independent security reviewer closed SEC-01, SEC-03 and migration P1/P2; no
unresolved high/critical finding in reviewed code. SEC-02 medium remains pending
user compatibility disposition. Independent UI/MCP reviewer closed QA01–QA04 at
`bd8572b` (later change is migration tooling only); 77 focused +85 Console tests.
The latter reviewer authored migrations, so provided **no data self-signoff**;
security reviewer independently reviewed the data fixes.

Integrated evidence:220 unit tests and typecheck pass;85 Console/MCP tests pass;
lint and production build pass (known Auth0 bundler warnings). Credentialed tests:
identity16/16, access/enrollment/bulk/consent10/10, waitlist routes3/3. Migration
regressions rerun separately after each author fix. Shared DB tests run serially;
the waitlist guard rejects outstanding outbox work, not completed synthetic history.

Remote stack: `codex/early-access-integration` remains at PR46's `44aa3a9`;
`codex/early-access-foundation` is the feature/review head targeting that separate
integration base. PR46 remains open and unchanged. Local specialist commits are
preserved in feature history. GitHub-signed publication head is required before
Vercel preview execution; verification policy is not weakened.

New runtime preview uses isolated `br-holy-sound-auugm104`, migrations through0008,
restricted runtime role, independent preview-only secrets, captured email, explicit
staging PymtHouse scope and its own MCP origin. Configuration is branch-scoped.
Preview acceptance and live token compatibility are **not yet claimed**.

## User amendment — Auth0-first joining and consolidated PR

User approved replacing waitlist join/sign-in with Auth0 and moving administration
inside Console chrome. Frozen contract: architecture amendment4, `91a19d2`.
No provider replacement, migration, credential change, production write or merge.

| Owner | Worktree | Scope | Handoff |
| --- | --- | --- | --- |
| Coordinator | root | Contracts, entry routing, integration fixtures, current-main MCP merge, Git/preview | `85a96eb`, `b0ce454`, `053dc5f`, `c18fc0f` |
| access_backend | auth0-backend | Auth0 join/sync, canonical admin/CSV/member permissions, enrollment context, consent authentication | `8738def`, referral fix `6b4c071` |
| data_owner (UI role) | auth0-ui | Auth0 CTAs, Console admin layout/navigation, membership preferences, legacy-link notices | `48e462c`, `83d34f0` |
| security_reviewer | review-security | Independent exact-commit MCP and Auth0 boundary review; no implementation edits | `b0ce454`, `48e462c`, final `c18fc0f` |

PR48 now targets main and includes PR46. PR46 is closed as superseded; its branch
and commits are preserved. PR48 remains draft. Current main `b3439cd` (CIMD
Codex/ChatGPT compatibility) was merged into the feature branch, not into production.
Token conflict resolution retains the shared approval gate and single-use receipts.

Implemented: Auth0-first join/sign-in, bounded referral/UTM return context,
admin→`/admin`, approved→`/home`, pending→waiting, explicit protocol return paths,
server-owned admin navigation and permissions, disabled/revoked precedence.
Old cookies no longer authorize member, consent, admin or CSV operations. Old
verification links confirm enrollment only, never a session or deferred consent.
Resend remains email delivery, with preview capture isolation unchanged.

Independent review found SEC-05: background membership reads could enroll before
referral context. Author fixed it by making reads non-enrolling. Reviewer closed
SEC-05 at `c18fc0f`;19 focused tests reproduced. No new critical/high findings.
SEC-02 (reusable/unbound refresh credentials) and SEC-04 (current-main native
loopback redirect flexibility at redemption) remain unresolved production holds.
They have not been silently accepted. No production-readiness claim.

Integrated checks:253 unit tests passed (33 database cases intentionally skipped
in credential-free run),108 Console/MCP tests passed; lint and typecheck passed.
Disposable Postgres:11 access/enrollment/bulk/consent checks +5 route checks passed;
the latter reran after SEC-05 with a real authenticated-read-before-referral-join
regression. Production build passed after regenerating stale route types caused
by moving `/admin`; final exact-source build and unchanged identity/migration
rechecks run before preview handoff. Existing Auth0 bundler warnings remain.

Preview publication stays on the existing isolated protected feature alias;
GitHub-signed head required, no protection-policy bypass. Live Auth0 callback,
admin/approved/pending browser acceptance and actual staging token issuance are
separate verification gates, not implied by mocked tests. Production inventory,
grandfather activation, secret reconciliation, cutover and access-enforcing
rollback planning remain unexecuted release work.
