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
 * Workspace · General — `?tab=workspace` per the v7 prototype.
 *
 * Two cards:
 *  1. General — workspace name / URL slug / avatar / default region
 *  2. Danger zone — transfer ownership + delete workspace
 */
export default function GeneralSection() {
  return (
    <>
      <SettingsHeader
        title="General"
        sub="Workspace settings · visible to all members"
      />
      <SettingsCard>
        <SettingsField
          label="Workspace name"
          hint="Shown in the sidebar and in invoices."
        >
          <SettingsInput defaultValue="Flipbook" />
        </SettingsField>

        <SettingsField
          label="Workspace URL"
          hint="Used in API endpoints and invite links."
        >
          <SettingsInputGroup>
            <InputAffix dim>livepeer.org/w/</InputAffix>
            <GroupInput defaultValue="flipbook" />
          </SettingsInputGroup>
        </SettingsField>

        <SettingsField
          label="Avatar"
          hint="A 1–2 character monogram or upload an image."
        >
          <SettingsAvatar initials="FB" variant="lp" />
          <IconButton>Upload</IconButton>
          <IconButton dim>Remove</IconButton>
        </SettingsField>

        <SettingsField
          label="Default region"
          hint="Closest GPU pool for new capabilities."
        >
          <SettingsSelect defaultValue="auto">
            <option value="auto">Auto · pick lowest p95</option>
            <option value="us-west">us-west · Oregon</option>
            <option value="us-east">us-east · Virginia</option>
            <option value="eu-central">eu-central · Frankfurt</option>
            <option value="ap-southeast">ap-southeast · Singapore</option>
          </SettingsSelect>
        </SettingsField>
      </SettingsCard>

      <SettingsHeader title="Danger zone" sub="Irreversible actions" />
      <SettingsCard danger>
        <SettingsField
          label="Transfer ownership"
          hint="Move this workspace to another billing owner."
        >
          <IconButton>Transfer…</IconButton>
        </SettingsField>
        <SettingsField
          label="Delete workspace"
          hint="All capabilities and jobs will be permanently deleted after 30 days."
        >
          <IconButton danger>Delete workspace…</IconButton>
        </SettingsField>
      </SettingsCard>
    </>
  );
}
