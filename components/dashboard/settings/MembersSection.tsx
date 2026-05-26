"use client";

import { Filter, MoreHorizontal, Plus } from "lucide-react";
import {
  IconButton,
  RolePill,
  SettingsAvatar,
  SettingsCard,
  SettingsHeader,
  ST_COLS_4,
  ST_HEAD_CLASS,
  type RolePillTone,
} from "./SettingsPrimitives";

interface Member {
  name: string;
  email: string;
  role: "Owner" | "Admin" | "Developer" | "Viewer";
  joined: string;
  avatar: string;
  color: string;
}

interface Invite {
  email: string;
  role: "Owner" | "Admin" | "Developer" | "Viewer";
  sent: string;
}

const MEMBERS: Member[] = [
  { name: "Zain Mehta", email: "zain@flipbook.page", role: "Owner", joined: "4mo ago", avatar: "ZM", color: "#1E9960" },
  { name: "Aliyah Park", email: "aliyah@flipbook.page", role: "Admin", joined: "3mo ago", avatar: "AP", color: "#25ABD0" },
  { name: "Marcos Diaz", email: "marcos@flipbook.page", role: "Developer", joined: "2mo ago", avatar: "MD", color: "#7A6BD9" },
  // `#fbbf24` (amber-300) was too light to carry white initials (~1.6:1).
  // `#d97706` (amber-600) keeps the warm/yellow identity and lifts contrast
  // to ~3.5:1 in both themes — same family, legible everywhere.
  { name: "Tomi Akinwale", email: "tomi@flipbook.page", role: "Developer", joined: "12d ago", avatar: "TA", color: "#d97706" },
];

const INVITES: Invite[] = [
  { email: "jules@flipbook.page", role: "Developer", sent: "3d ago" },
  { email: "kira@flipbook.page", role: "Viewer", sent: "6h ago" },
];

/**
 * Workspace · Members — `?tab=members` per the v7 prototype.
 *
 * Two cards: active members (Name / Role / Joined / row menu) and pending
 * invites (Email / Role / Sent / Resend · Revoke). Header shows the seat
 * count and Filter + Invite buttons.
 */
export default function MembersSection() {
  return (
    <>
      <SettingsHeader
        title="Members"
        sub={`Anyone with workspace access · ${MEMBERS.length} of 5 free seats`}
        action={
          <>
            <IconButton>
              <Filter className="h-3 w-3" aria-hidden="true" />
              Filter
            </IconButton>
            <IconButton primary>
              <Plus className="h-3 w-3" aria-hidden="true" />
              Invite
            </IconButton>
          </>
        }
      />

      <SettingsCard>
        <div className={`${ST_COLS_4} ${ST_HEAD_CLASS}`}>
          <span>Name</span>
          <span>Role</span>
          <span>Joined</span>
          <span aria-hidden="true" />
        </div>
        {MEMBERS.map((m) => (
          <div
            key={m.email}
            className={`${ST_COLS_4} border-b border-hairline last:border-b-0 transition-colors hover:bg-zebra`}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <SettingsAvatar initials={m.avatar} color={m.color} />
              <div className="min-w-0">
                <p className="truncate text-[13px] text-fg">{m.name}</p>
                <p className="truncate font-mono text-[11.5px] text-fg-faint">
                  {m.email}
                </p>
              </div>
            </div>
            <div>
              <RolePill tone={m.role.toLowerCase() as RolePillTone}>
                {m.role}
              </RolePill>
            </div>
            <div className="text-[12.5px] text-fg-faint">{m.joined}</div>
            <div className="flex justify-end">
              <IconButton ghost aria-label="Member actions">
                <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              </IconButton>
            </div>
          </div>
        ))}
      </SettingsCard>

      <SettingsHeader
        title="Pending invites"
        sub={`${INVITES.length} outstanding`}
      />

      <SettingsCard>
        <div className={`${ST_COLS_4} ${ST_HEAD_CLASS}`}>
          <span>Email</span>
          <span>Role</span>
          <span>Sent</span>
          <span aria-hidden="true" />
        </div>
        {INVITES.map((inv) => (
          <div
            key={inv.email}
            className={`${ST_COLS_4} border-b border-hairline last:border-b-0 transition-colors hover:bg-zebra`}
          >
            <div className="truncate text-[13px] text-fg">{inv.email}</div>
            <div>
              <RolePill tone={inv.role.toLowerCase() as RolePillTone}>
                {inv.role}
              </RolePill>
            </div>
            <div className="text-[12.5px] text-fg-faint">{inv.sent}</div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="text-[12px] text-fg-strong transition-colors hover:text-fg"
              >
                Resend
              </button>
              <button
                type="button"
                className="text-[12px] text-fg-faint transition-colors hover:text-fg"
              >
                Revoke
              </button>
            </div>
          </div>
        ))}
      </SettingsCard>
    </>
  );
}
