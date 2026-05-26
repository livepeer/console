"use client";

import {
  MiniToggle,
  SettingsCard,
  SettingsHeader,
  ST_HEAD_CLASS,
} from "./SettingsPrimitives";

interface NotificationRow {
  name: string;
  desc: string;
  email: boolean;
  slack: boolean;
}

const ROWS: NotificationRow[] = [
  { name: "Run failures", desc: "A run errors out or times out.", email: true, slack: true },
  { name: "Quota thresholds", desc: "Free tier at 80% / 95%.", email: true, slack: false },
  { name: "Billing receipts", desc: "Monthly invoice and payment confirmations.", email: true, slack: false },
  { name: "Capability updates", desc: "New models added to the marketplace.", email: false, slack: false },
  { name: "Security events", desc: "New device sign-ins, key rotations.", email: true, slack: false },
  { name: "Weekly digest", desc: "Summary of last week's usage.", email: false, slack: false },
];

// 3-column layout for the notif table — Event / Email toggle / Slack toggle.
// Spelled out rather than in primitives because it's specific to this view.
const NOTIF_COLS =
  "grid items-center gap-3 px-[18px] py-3 grid-cols-[1fr_72px_72px]";

/**
 * Account · Notifications — `?tab=notifications` per the v7 prototype.
 *
 * One card: per-event preferences with Email + Slack toggles. Initial state
 * is local to each row (mock); real wiring would lift state to a form.
 */
export default function NotificationsSection() {
  return (
    <>
      <SettingsHeader
        title="Notifications"
        sub="Choose what to be notified about"
      />
      <SettingsCard>
        <div className={`${NOTIF_COLS} ${ST_HEAD_CLASS}`}>
          <span>Event</span>
          <span className="justify-self-end">Email</span>
          <span className="justify-self-end">Slack</span>
        </div>
        {ROWS.map((row) => (
          <div
            key={row.name}
            className={`${NOTIF_COLS} border-b border-hairline last:border-b-0 transition-colors hover:bg-zebra`}
          >
            <div>
              <p className="text-[13px] text-fg">{row.name}</p>
              <p className="mt-0.5 text-[11.5px] text-fg-faint">{row.desc}</p>
            </div>
            <div className="justify-self-end">
              <MiniToggle defaultOn={row.email} />
            </div>
            <div className="justify-self-end">
              <MiniToggle defaultOn={row.slack} />
            </div>
          </div>
        ))}
      </SettingsCard>
    </>
  );
}
