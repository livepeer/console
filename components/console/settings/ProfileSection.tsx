"use client";

import {
  GroupInput,
  IconButton,
  InputAffix,
  SettingsAvatar,
  SettingsCard,
  SettingsField,
  SettingsHeader,
  SettingsInput,
  SettingsInputGroup,
  SettingsSelect,
} from "./SettingsPrimitives";

/**
 * Account · Profile — `?tab=profile` per the v7 prototype.
 *
 * One card: name / email / @username / time zone / avatar. Account-scoped
 * (visible only to this user) per the section subtitle.
 */
export default function ProfileSection() {
  return (
    <>
      <SettingsHeader
        title="Profile"
        sub="Your account · only visible to you"
      />
      <SettingsCard>
        <SettingsField label="Name">
          <SettingsInput defaultValue="Zain Mehta" />
        </SettingsField>

        <SettingsField label="Email">
          <SettingsInput defaultValue="zain@flipbook.page" type="email" />
        </SettingsField>

        <SettingsField
          label="Username"
          hint="Used in mentions and audit logs."
        >
          <SettingsInputGroup>
            <InputAffix dim>@</InputAffix>
            <GroupInput defaultValue="zain" />
          </SettingsInputGroup>
        </SettingsField>

        <SettingsField label="Time zone">
          <SettingsSelect defaultValue="los_angeles">
            <option value="los_angeles">America/Los_Angeles · GMT−7</option>
            <option value="new_york">America/New_York · GMT−4</option>
            <option value="london">Europe/London · GMT+1</option>
            <option value="singapore">Asia/Singapore · GMT+8</option>
          </SettingsSelect>
        </SettingsField>

        <SettingsField label="Avatar">
          <SettingsAvatar initials="ZM" color="#1E9960" />
          <IconButton>Upload</IconButton>
        </SettingsField>
      </SettingsCard>
    </>
  );
}
