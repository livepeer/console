"use client";

import { useAuth } from "@/components/console/AuthContext";
import Button from "@/components/design-system/Button";
import {
  SettingsAvatar,
  SettingsCard,
  SettingsField,
  SettingsHeader,
} from "./SettingsPrimitives";

/**
 * Account — `?tab=account`, the page `/settings` renders by default.
 *
 * Replaces the old `Organization · General` + `Account · Profile` pair. They
 * were split because the console assumed multi-tenancy: an organization you
 * shared with members, and a personal profile inside it. The pilot has one
 * signed-in person and no organizations, so the split described a structure
 * that isn't there — two pages, each one card, both filled with the same
 * person's details.
 *
 * Every value here is read-only and comes from the Auth0 session. That is a
 * deliberate downgrade from what the two sections used to render: organization
 * name, URL slug, default region, username and time zone were editable-looking
 * inputs seeded with mock data (`Flipbook`, `Zain Mehta`) that saved nowhere.
 * Name and email are owned by the identity provider you signed in with, and
 * there is no profile-write endpoint behind them — so they are shown as
 * values, not as fields that imply a save.
 */
export default function AccountSection() {
  const { user, disconnect } = useAuth();

  if (!user) return null;

  const providerLabel =
    user.provider === "github"
      ? "GitHub"
      : user.provider === "google"
        ? "Google"
        : "Email";

  return (
    <>
      <SettingsHeader
        title="Account"
        sub="Signed in with your identity provider · only visible to you"
      />
      <SettingsCard>
        <SettingsField label="Avatar">
          {user.avatarUrl ? (
            // Raw <img> per CLAUDE.md — next/image is not used in this app.
            <img
              src={user.avatarUrl}
              alt=""
              className="h-8 w-8 shrink-0 rounded-full object-cover"
            />
          ) : (
            <SettingsAvatar initials={user.initials} variant="lp" />
          )}
        </SettingsField>

        <SettingsField label="Name" hint={`Provided by ${providerLabel}.`}>
          <span className="text-[13px] text-fg">{user.name}</span>
        </SettingsField>

        <SettingsField
          label="Email"
          hint="The address your agent runtimes sign in with."
        >
          <span className="text-[13px] text-fg">{user.email}</span>
        </SettingsField>

        <SettingsField
          label="Account ID"
          hint="Quote this when reporting a failed generation."
        >
          <span className="break-all font-mono text-[12px] text-fg-strong">
            {user.id}
          </span>
        </SettingsField>

        <SettingsField
          label="Sign out"
          hint="Ends this session in the console. Agent runtimes stay connected."
        >
          <Button variant="secondary" size="xs" onClick={disconnect}>
            Sign out
          </Button>
        </SettingsField>
      </SettingsCard>
    </>
  );
}
