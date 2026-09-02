"use client";

import {
  THEME_OPTIONS,
  useTheme,
  type ThemePreference,
} from "@/components/console/ThemeContext";
import {
  SettingsCard,
  SettingsField,
  SettingsHeader,
} from "./SettingsPrimitives";

const DESCRIPTIONS: Record<ThemePreference, string> = {
  light: "Always use the light theme.",
  dark: "Always use the dark theme.",
  system: "Follow your OS preference.",
};

/**
 * Account · Appearance — `?tab=appearance`.
 *
 * Single field: theme preference (Light / Dark / System). System follows
 * the OS-level `prefers-color-scheme` and re-resolves in real time when
 * the user toggles their OS setting. Stored locally in
 * `localStorage["theme"]` — shared with the marketing site's ThemeToggle so
 * the two surfaces stay in sync. See `ThemeContext.tsx`.
 *
 * Each option is rendered as a tile-style radio so the icon and label
 * read at a glance
 * but with more breathing room since theme is a single-shot choice.
 */
export default function AppearanceSection() {
  const { preference, setPreference } = useTheme();

  return (
    <>
      <SettingsHeader
        title="Appearance"
        sub="How the console looks · this device only"
      />
      <SettingsCard>
        <SettingsField
          label="Theme"
          hint="Choose how the console looks. System follows your OS preference."
        >
          <div
            role="radiogroup"
            aria-label="Theme preference"
            className="flex w-full flex-wrap gap-2"
          >
            {THEME_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const selected = preference === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setPreference(opt.value)}
                  className={`group flex min-w-[140px] flex-1 items-center gap-3 rounded-md border px-3.5 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-bright/40 ${
                    selected
                      ? "border-green/40 bg-green/15"
                      : "border-hairline bg-dark-card hover:border-subtle hover:bg-hover"
                  }`}
                >
                  <div
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-[6px] border ${
                      selected
                        ? "border-green/40 bg-green/15 text-green-bright"
                        : "border-hairline bg-dark text-fg-faint"
                    }`}
                    aria-hidden="true"
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-[13px] font-medium ${
                        selected ? "text-green-bright" : "text-fg-strong"
                      }`}
                    >
                      {opt.label}
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-fg-faint">
                      {DESCRIPTIONS[opt.value]}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </SettingsField>
      </SettingsCard>
    </>
  );
}
