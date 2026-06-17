"use client";

import Link from "next/link";
import { Info, KeyRound, Plus, Terminal } from "lucide-react";
import {
  SettingsHeader,
  SettingsCard,
  IconButton,
  RolePill,
  ST_COLS_5,
  ST_HEAD_CLASS,
} from "@/components/dashboard/settings/SettingsPrimitives";

// ─── Mock deploy tokens ──────────────────────────────────────────────────────
//
// Deploy tokens are the *organization-level* credential the Livepeer CLI / Runner
// SDK uses to push pipelines (`livepeer push --env <env>`). Unlike API keys —
// which are environment-scoped and authenticate inference *calls* — one deploy
// token can target any environment via the `--env` flag, mirroring Modal's
// organization-level tokens. Admin-privileged: they can build, register, and stop
// capabilities on the network.

interface DeployToken {
  id: string;
  name: string;
  prefix: string;
  created: string;
  lastUsed: string;
  createdBy: string;
}

const DEPLOY_TOKENS: DeployToken[] = [
  {
    id: "dt_1",
    name: "CI · GitHub Actions",
    prefix: "lp_deploy_t8x2",
    created: "Apr 22, 2026",
    lastUsed: "2 hours ago",
    createdBy: "Zain",
  },
  {
    id: "dt_2",
    name: "Zain · laptop",
    prefix: "lp_deploy_q4m9",
    created: "Mar 30, 2026",
    lastUsed: "yesterday",
    createdBy: "Zain",
  },
];

export default function DeployTokensSection() {
  return (
    <div>
      <SettingsHeader
        title="Deploy tokens"
        sub="Organization-level credentials for the Livepeer CLI. Used to push pipelines to any environment."
        action={
          <IconButton primary>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Create token
          </IconButton>
        }
      />

      {/* Relationship to API keys — the two-credential model made explicit. */}
      <div className="mb-4 flex items-start gap-2.5 rounded-md border border-hairline bg-dark-lighter px-3.5 py-3">
        <Info
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-faint"
          aria-hidden="true"
        />
        <p className="text-[12.5px] leading-[1.5] text-fg-muted">
          Deploy tokens are <span className="text-fg-strong">organization-scoped</span>{" "}
          and authorize <span className="text-fg-strong">deploying</span> pipelines
          to any environment with{" "}
          <span className="font-mono text-[11.5px] text-fg-strong">
            livepeer push --env
          </span>
          . To authenticate inference <span className="text-fg-strong">calls</span>,
          use{" "}
          <Link
            href="/keys"
            className="text-green-bright underline decoration-green-bright/40 underline-offset-2 hover:text-green-light"
          >
            API keys
          </Link>{" "}
          instead — those are scoped to a single environment.
        </p>
      </div>

      {/* Token table */}
      <SettingsCard padded>
        <div className={`${ST_COLS_5} ${ST_HEAD_CLASS}`}>
          <div>Token</div>
          <div>Scope</div>
          <div>Created</div>
          <div>Last used</div>
          <div className="justify-self-end">By</div>
        </div>
        {DEPLOY_TOKENS.map((t) => (
          <div
            key={t.id}
            className={`${ST_COLS_5} border-b border-hairline last:border-b-0`}
          >
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-medium text-fg">
                {t.name}
              </p>
              <p className="mt-0.5 truncate font-mono text-[11.5px] text-fg-faint">
                {t.prefix}
                <span className="px-0.5 text-fg-disabled">…</span>
              </p>
            </div>
            <div>
              <RolePill tone="admin">Organization</RolePill>
            </div>
            <div className="text-[12.5px] text-fg-strong">{t.created}</div>
            <div className="text-[12.5px] text-fg-strong">{t.lastUsed}</div>
            <div className="justify-self-end text-[12.5px] text-fg-faint">
              {t.createdBy}
            </div>
          </div>
        ))}
      </SettingsCard>

      {/* CLI usage */}
      <SettingsHeader
        title="Using a deploy token"
        sub="Authenticate the CLI once, then target an environment per deploy."
      />
      <SettingsCard padded>
        <div className="flex items-center gap-2 border-b border-hairline px-[18px] py-2.5">
          <Terminal
            className="h-3.5 w-3.5 text-fg-faint"
            aria-hidden="true"
          />
          <span className="text-[12.5px] font-medium text-fg">Quickstart</span>
        </div>
        <pre className="overflow-x-auto px-[18px] py-3.5 font-mono text-[12px] leading-[1.9] text-fg-muted">
          <span className="text-fg-disabled"># authenticate the CLI (once)</span>
          {"\n"}
          <span className="text-fg-disabled">$ </span>
          <span className="text-fg">livepeer token new</span>
          {"\n\n"}
          <span className="text-fg-disabled"># deploy a pipeline to an environment</span>
          {"\n"}
          <span className="text-fg-disabled">$ </span>
          <span className="text-fg">livepeer push </span>
          <span className="text-fg-faint">--env production</span>
        </pre>
      </SettingsCard>

      {/* Footnote linking back to the call credential */}
      <p className="mt-3 flex items-center gap-1.5 px-1 text-[11.5px] text-fg-disabled">
        <KeyRound className="h-3 w-3" aria-hidden="true" />
        Looking for inference API keys? They live under{" "}
        <Link
          href="/keys"
          className="text-fg-faint underline decoration-transparent underline-offset-2 hover:text-fg-strong hover:decoration-current"
        >
          Environment → API keys
        </Link>
        .
      </p>
    </div>
  );
}
