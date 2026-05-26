"use client";

import { Plus } from "lucide-react";
import {
  IconButton,
  RolePill,
  SettingsCard,
  SettingsField,
  SettingsHeader,
  SettingsInput,
  ST_COLS_4,
  ST_HEAD_CLASS,
} from "./SettingsPrimitives";

interface SessionRow {
  device: string;
  where: string;
  when: string;
  current: boolean;
}

const SESSIONS: SessionRow[] = [
  { device: "MacBook Pro · Chrome", where: "San Francisco, CA", when: "Active now", current: true },
  { device: "iPhone 15 · Safari", where: "San Francisco, CA", when: "2 hours ago", current: false },
  { device: "Linux · Firefox", where: "Portland, OR", when: "Yesterday", current: false },
];

/**
 * Account · Security — `?tab=security` per the v7 prototype.
 *
 * Two cards:
 *  1. Authentication — password (with Change action), 2FA (Enabled pill +
 *     recovery codes), passkeys (Add passkey + existing list)
 *  2. Active sessions — table of devices with `Revoke` per row +
 *     "Sign out of all other sessions" footer link
 */
export default function SecuritySection() {
  return (
    <>
      <SettingsHeader
        title="Authentication"
        sub="Sign-in methods for your account"
      />
      <SettingsCard>
        <SettingsField
          label="Password"
          hint="Last changed 4 months ago."
          action={<IconButton>Change</IconButton>}
        >
          <SettingsInput
            type="password"
            value="••••••••••••"
            disabled
            readOnly
          />
        </SettingsField>

        <SettingsField
          label="Two-factor authentication"
          hint="Use an authenticator app for sign-in."
          action={<RolePill tone="active">Enabled</RolePill>}
        >
          <p className="text-[12.5px] text-fg-faint">
            Recovery codes generated 4mo ago ·{" "}
            <button
              type="button"
              className="text-fg-strong underline-offset-2 transition-colors hover:text-fg hover:underline"
            >
              Regenerate
            </button>
          </p>
        </SettingsField>

        <SettingsField
          label="Passkeys"
          hint="Sign in with biometrics."
          action={
            <IconButton>
              <Plus className="h-3 w-3" aria-hidden="true" />
              Add passkey
            </IconButton>
          }
        >
          <p className="text-[12.5px] text-fg-faint">
            1 passkey · MacBook Pro · added 2mo ago
          </p>
        </SettingsField>
      </SettingsCard>

      <SettingsHeader
        title="Active sessions"
        sub="Devices currently signed in to your account"
      />
      <SettingsCard>
        <div className={`${ST_COLS_4} ${ST_HEAD_CLASS}`}>
          <span>Device</span>
          <span>Location</span>
          <span>Last active</span>
          <span aria-hidden="true" />
        </div>
        {SESSIONS.map((s, i) => (
          <div
            key={i}
            className={`${ST_COLS_4} border-b border-hairline last:border-b-0 transition-colors hover:bg-zebra`}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-[13px] text-fg">
                {s.device}
              </span>
              {s.current && <RolePill tone="active">this device</RolePill>}
            </div>
            <div className="text-[12.5px] text-fg-faint">{s.where}</div>
            <div className="text-[12.5px] text-fg-faint">{s.when}</div>
            <div className="flex justify-end">
              {!s.current && (
                <button
                  type="button"
                  className="text-[12px] text-tone-amber transition-colors"
                >
                  Revoke
                </button>
              )}
            </div>
          </div>
        ))}
        <div className="px-[18px] py-3">
          <button
            type="button"
            className="text-[12.5px] text-tone-amber transition-colors"
          >
            Sign out of all other sessions
          </button>
        </div>
      </SettingsCard>
    </>
  );
}
