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
