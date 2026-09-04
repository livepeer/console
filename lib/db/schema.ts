import {
  boolean,
  integer,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const userStatus = pgEnum("user_status", ["active", "disabled"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    status: userStatus("status").default("active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
  },
  (table) => [index("users_status_idx").on(table.status)]
);

export const authIdentities = pgTable(
  "auth_identities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerSubject: text("provider_subject").notNull(),
    providerMetadata: jsonb("provider_metadata")
      .$type<Record<string, string>>()
      .default({})
      .notNull(),
    externalUserId: text("external_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("auth_identities_provider_subject_idx").on(
      table.provider,
      table.providerSubject
    ),
    uniqueIndex("auth_identities_external_user_id_idx").on(
      table.externalUserId
    ),
    index("auth_identities_user_idx").on(table.userId),
  ]
);

export const userEmails = pgTable(
  "user_emails",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    normalizedEmail: text("normalized_email").notNull(),
    source: text("source").notNull(),
    isPrimary: boolean("is_primary").default(false).notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("user_emails_user_normalized_idx").on(
      table.userId,
      table.normalizedEmail
    ),
    uniqueIndex("user_emails_verified_normalized_idx")
      .on(table.normalizedEmail)
      .where(sql`${table.verifiedAt} is not null`),
    uniqueIndex("user_emails_primary_user_idx")
      .on(table.userId)
      .where(sql`${table.isPrimary} = true`),
  ]
);

export const signupStatus = pgEnum("signup_status", [
  "pending",
  "confirmed",
  "invited",
  "unsubscribed",
  "suppressed",
]);

export const accountRole = pgEnum("account_role", ["member", "admin"]);

export const waitlistSignups = pgTable(
  "waitlist_signups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    normalizedEmail: text("normalized_email").notNull(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    accountRole: accountRole("account_role").default("member").notNull(),
    role: text("role").default("").notNull(),
    useCase: text("use_case").default("").notNull(),
    referralCode: text("referral_code").notNull(),
    referredBy: uuid("referred_by").references(
      (): AnyPgColumn => waitlistSignups.id,
      { onDelete: "set null" }
    ),
    status: signupStatus("status").default("pending").notNull(),
    marketingConsent: boolean("marketing_consent").default(false).notNull(),
    firstTouch: jsonb("first_touch").$type<Record<string, string>>().notNull(),
    lastTouch: jsonb("last_touch").$type<Record<string, string>>().notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
  },
  (table) => [
    uniqueIndex("waitlist_signups_normalized_email_idx").on(
      table.normalizedEmail
    ),
    uniqueIndex("waitlist_signups_referral_code_idx").on(table.referralCode),
    index("waitlist_signups_status_idx").on(table.status),
    uniqueIndex("waitlist_signups_user_idx")
      .on(table.userId)
      .where(sql`${table.userId} is not null`),
    index("waitlist_signups_referred_by_idx").on(table.referredBy),
    index("waitlist_signups_confirmed_idx").on(table.confirmedAt, table.id),
  ]
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    signupId: uuid("signup_id")
      .notNull()
      .references(() => waitlistSignups.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    requestedMarketingConsent: boolean("requested_marketing_consent")
      .default(false)
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("verification_tokens_hash_idx").on(table.tokenHash),
    index("verification_tokens_signup_idx").on(table.signupId),
  ]
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    signupId: uuid("signup_id")
      .notNull()
      .references(() => waitlistSignups.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("sessions_hash_idx").on(table.tokenHash),
    index("sessions_signup_idx").on(table.signupId),
  ]
);

export const pointEvents = pgTable(
  "point_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    signupId: uuid("signup_id")
      .notNull()
      .references(() => waitlistSignups.id, { onDelete: "cascade" }),
    points: integer("points").notNull(),
    reason: text("reason").notNull(),
    referralSignupId: uuid("referral_signup_id")
      .notNull()
      .references(() => waitlistSignups.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("point_events_reason_referral_idx").on(
      table.reason,
      table.referralSignupId
    ),
    index("point_events_signup_idx").on(table.signupId),
  ]
);

export const rateLimits = pgTable(
  "rate_limits",
  {
    keyHash: text("key_hash").notNull(),
    bucket: timestamp("bucket", { withTimezone: true }).notNull(),
    attempts: integer("attempts").default(1).notNull(),
  },
  (table) => [
    uniqueIndex("rate_limits_key_bucket_idx").on(table.keyHash, table.bucket),
  ]
);

export const attributionTouches = pgTable(
  "attribution_touches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    signupId: uuid("signup_id")
      .notNull()
      .references(() => waitlistSignups.id, { onDelete: "cascade" }),
    data: jsonb("data").$type<Record<string, string>>().notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("attribution_touches_signup_idx").on(table.signupId)]
);

export const consentEvents = pgTable(
  "consent_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    signupId: uuid("signup_id")
      .notNull()
      .references(() => waitlistSignups.id, { onDelete: "cascade" }),
    purpose: text("purpose").notNull(),
    granted: boolean("granted").notNull(),
    disclosureVersion: text("disclosure_version").notNull(),
    source: text("source").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("consent_events_signup_idx").on(table.signupId)]
);

export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    signupId: uuid("signup_id")
      .notNull()
      .references(() => waitlistSignups.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    terminalAt: timestamp("terminal_at", { withTimezone: true }),
    lastErrorCode: text("last_error_code"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("email_outbox_idempotency_idx").on(table.idempotencyKey),
    index("email_outbox_unprocessed_idx").on(table.processedAt),
  ]
);
