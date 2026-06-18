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
 * Organization · General — `?tab=organization` per the v7 prototype.
 *
 * Two cards:
 *  1. General — organization name / URL slug / avatar / default region
 *  2. Danger zone — transfer ownership + delete organization
 */
export default function GeneralSection() {
  return (
    <>
      <SettingsHeader
        title="General"
        sub="Organization settings · visible to all members"
      />
      <SettingsCard>
        <SettingsField
          label="Organization name"
          hint="Shown in the sidebar and in invoices."
        >
          <SettingsInput defaultValue="Flipbook" />
        </SettingsField>

        <SettingsField
          label="Organization URL"
          hint="Used in API endpoints and invite links."
        >
          <SettingsInputGroup>
            <InputAffix dim>livepeer.org/orgs/</InputAffix>
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
          hint="Closest GPU pool for new apps."
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
          hint="Move this organization to another billing owner."
        >
          <IconButton>Transfer…</IconButton>
        </SettingsField>
        <SettingsField
          label="Delete organization"
          hint="All apps and activity will be permanently deleted after 30 days."
        >
          <IconButton danger>Delete organization…</IconButton>
        </SettingsField>
      </SettingsCard>
    </>
  );
}
