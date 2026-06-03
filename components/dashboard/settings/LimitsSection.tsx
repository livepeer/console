"use client";

import Link from "next/link";
import { ArrowRight, Bell, Check } from "lucide-react";
import {
  GroupInput,
  InputAffix,
  SettingsCard,
  SettingsField,
  SettingsHeader,
  SettingsInput,
  SettingsInputGroup,
} from "./SettingsPrimitives";

const REGIONS = ["us-west", "us-east", "eu-central", "ap-southeast", "sa-east"];

/**
 * Organization · Limits — `?tab=usage-limits` per the v7 prototype.
 *
 * Two cards:
 *  1. Limits & quotas — hard spend cap, concurrent streams, per-key rate
 *     limit, allowed regions (chip multi-select)
 *  2. Soft alerts — empty state pointing back to /usage where
 *     alerts live next to the data they describe
 */
export default function LimitsSection() {
  return (
    <>
      <SettingsHeader
        title="Limits & quotas"
        sub="Caps applied to this organization"
      />
      <SettingsCard>
        <SettingsField
          label="Hard spend cap"
          hint="Suspend all apps if monthly spend exceeds this amount."
        >
          <SettingsInputGroup>
            <InputAffix dim>$</InputAffix>
            <GroupInput defaultValue="50" />
            <InputAffix side="right" dim>
              / month
            </InputAffix>
          </SettingsInputGroup>
        </SettingsField>

        <SettingsField
          label="Concurrent streams"
          hint="Max simultaneous live streams. Free tier allows 3."
        >
          <SettingsInput defaultValue="3" disabled />
        </SettingsField>

        <SettingsField
          label="Per-key rate limit"
          hint="Calls per second, applied to each API key."
        >
          <SettingsInput defaultValue="10" />
        </SettingsField>

        <SettingsField
          label="Allowed regions"
          hint="Restrict apps to specific GPU pools."
        >
          <div className="flex flex-wrap gap-1.5">
            {REGIONS.map((r, i) => {
              const on = i < 3;
              return (
                <button
                  key={r}
                  type="button"
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 font-mono text-[11.5px] transition-colors ${
                    on
                      ? "border-green/40 bg-green/15 text-green-bright"
                      : "border-hairline bg-dark-card text-fg-strong hover:border-subtle"
                  }`}
                >
                  {on && <Check className="h-2.5 w-2.5" aria-hidden="true" />}
                  {r}
                </button>
              );
            })}
          </div>
        </SettingsField>
      </SettingsCard>

      <SettingsHeader
        title="Soft alerts"
        sub="Notify when usage crosses thresholds — does not block."
      />
      <SettingsCard>
        <div className="px-5 py-9 text-center">
          <Bell
            className="mx-auto h-[22px] w-[22px] text-fg-disabled"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <p className="mt-2 text-[13.5px] font-medium text-fg">
            Manage alerts in Usage
          </p>
          <p className="mt-1 text-[12.5px] text-fg-faint">
            Alerts live next to the data they describe.{" "}
            <Link
              href="/usage"
              className="inline-flex items-center gap-1 text-fg-strong transition-colors hover:text-fg"
            >
              Go to Usage <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </p>
        </div>
      </SettingsCard>
    </>
  );
}
