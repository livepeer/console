# Waitlist cutover runbook

Console now owns the public `/waitlist` and `/verify` routes, the waitlist API,
and the waitlist-session-protected `/admin` export. Auth0 remains the Console
credential authority. The waitlist magic-link session remains separate and is
the only session accepted by `/admin`.

## Database boundaries

- Migrations `0000` through `0004` reproduce the deployed waitlist schema.
- Migration `0005_canonical_user_foundation` adds `users`,
  `auth_identities`, `user_emails`, and the nullable waitlist user link.
- Production uses the existing waitlist Postgres database. Preview deployments,
  CI, and destructive tests must use an isolated database branch.
- Do not copy production records. Apply `0005` in place after taking the
  provider's normal point-in-time backup and before enabling Console traffic.

Authenticated requests keep the existing deterministic PymtHouse external user
ID. A successful Auth0 login also best-effort upserts the application-owned user,
identity, and primary email. Only an Auth0-verified email can link a confirmed,
unclaimed waitlist record. Conflicts are logged and never overwritten. Existing
Console behavior continues when synchronization is unavailable; endpoints that
require the canonical record must use `requireCanonicalUser()` and fail closed.

## Required deployment configuration

Copy the existing production values into the Console Vercel production
environment for `DATABASE_URL`, `ATTRIBUTION_HASH_SECRET`, `RESEND_API_KEY`,
`RESEND_NEWSLETTER_SEGMENT_ID`, `EMAIL_FROM`, `EMAIL_REPLY_TO`,
`INTERNAL_OUTBOX_SECRET`, `NEXT_PUBLIC_SITE_URL`, and
`NEXT_PUBLIC_POSTHOG_KEY`. Configure equivalent preview values against an
isolated database branch. Keep Auth0, PymtHouse, and MCP variables unchanged.

The outbox retry worker is `POST /api/internal/outbox` with
`Authorization: Bearer <INTERNAL_OUTBOX_SECRET>`. Preserve the existing external
scheduler until an explicitly configured Vercel cron replacement is tested.

## Staged release checklist

1. Deploy a preview with the isolated database and migrations `0000`-`0005`.
2. Verify `/waitlist`, signup delivery, `/verify`, referrals, consent changes,
   newsletter sync, admin access, CSV export, and outbox retries.
3. Verify Auth0 callback and repeat-login reconciliation, including verified and
   unverified email cases and an intentional database outage.
4. Smoke-test billing, keys, device approval, MCP discovery, and `/api/mcp`; the
   external PymtHouse identifier must match its pre-cutover value.
5. Record production counts for signups, confirmed members, consent events, and
   pending outbox events. Apply `0005`, deploy Console, and compare the counts.
6. Move `earlyaccess.livepeer.org` only after the deployed checks pass. Retain
   the standalone waitlist deployment and its domain mapping as the rollback
   target until the observation window closes.

Rollback means moving the domain back to the retained waitlist deployment. The
additive canonical-user migration may remain; it does not change legacy waitlist
or Console identifiers.
