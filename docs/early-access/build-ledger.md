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
