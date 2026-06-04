"use client";

import { Check } from "lucide-react";
import CopyButton from "@/components/dashboard/CopyButton";
import {
  PIPELINES,
  MOCK_RECENT_REQUESTS,
  STARTER_API_KEY,
} from "@/lib/dashboard/mock-data";

export const FIRST_RUN_DISMISSED_KEY = "livepeer.firstRunDismissed";
/** Fired in-tab whenever the dismissal flag changes (storage events only fire
 *  across tabs). Listened to by /home so Quickstart re-opens the checklist. */
export const FIRST_RUN_CHANGED_EVENT = "livepeer:firstrun-changed";

interface Props {
  /** Called when the user finishes or skips. Parent flips Home to the standard view. */
  onDismiss: () => void;
}

/**
 * Prototype override. The demo org (Flipbook) already has deployed apps and
 * recorded calls, so auto-detection would mark both onboarding steps done and
 * the checklist would only ever show its completed state. Forcing this keeps
 * the pre-deploy flow visible in the prototype. Set to `false` (or delete this
 * and the guards below) once real per-account run history backs the steps.
 */
const MOCK_FORCE_PREDEPLOY = true;

/**
 * FirstRunChecklist — operator-first onboarding: the core platform loop in two
 * steps, **deploy an example app → call it**. Completion is auto-detected from
 * real state (you have a deployed app · you've made a call) — there are no
 * "I've done it" buttons to self-attest. The active step shows the command to
 * run; finished steps check themselves off.
 */
export default function FirstRunChecklist({ onDismiss }: Props) {
  const hasDeployed =
    !MOCK_FORCE_PREDEPLOY && PIPELINES.some((p) => p.status === "deployed");
  const hasCall = !MOCK_FORCE_PREDEPLOY && MOCK_RECENT_REQUESTS.length > 0;
  const allDone = hasDeployed && hasCall;

  const token = `${STARTER_API_KEY.prefix}_live_…`;
  const deployCmd = "livepeer init hello-world && livepeer push --env production";
  const callCmd = `curl https://api.livepeer.org/run/hello-world -H "Authorization: Bearer ${token}" -d '{"input":"hello"}'`;

  return (
    <section
      aria-label="Get started"
      className="overflow-hidden rounded-md border border-hairline bg-dark-lighter shadow-card"
    >
      <Step
        num={1}
        title="Deploy an example app"
        desc="Push a ready-made hello-world pipeline with the Livepeer CLI — it builds the image and registers your app on the network."
        done={hasDeployed}
        active={!hasDeployed}
        command={deployCmd}
      />
      <Step
        num={2}
        title="Call your app"
        desc="Send your first request and get a response back — the full loop, end to end."
        done={hasCall}
        active={hasDeployed && !hasCall}
        pending={!hasDeployed}
        command={callCmd}
      />

      {allDone && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline bg-green/[0.05] px-4 py-3">
          <p className="inline-flex items-center gap-2 text-[13px] font-medium text-fg">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-green text-white">
              <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
            </span>
            You&apos;ve deployed and called an app — that&apos;s the whole loop.
          </p>
          <button
            type="button"
            onClick={onDismiss}
            className="btn-primary inline-flex h-[28px] items-center rounded-[4px] px-3 text-[12.5px] font-medium transition-colors"
          >
            Done
          </button>
        </div>
      )}
    </section>
  );
}

function Step({
  num,
  title,
  desc,
  done,
  active,
  pending,
  command,
}: {
  num: number;
  title: string;
  desc: string;
  done: boolean;
  active: boolean;
  pending?: boolean;
  command: string;
}) {
  return (
    <div
      className={`border-b border-hairline px-4 py-4 last:border-b-0 ${
        pending ? "opacity-55" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full font-mono text-[11px] ${
            done
              ? "border border-green-light bg-green text-white"
              : active
                ? "border border-green-bright text-green-bright"
                : "border border-subtle text-fg-faint"
          }`}
          aria-hidden="true"
        >
          {done ? <Check className="h-3 w-3" strokeWidth={3} /> : num}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={`text-[13.5px] font-medium ${
              done ? "text-fg-strong" : "text-fg"
            }`}
          >
            {title}
          </p>
          <p className="mt-0.5 text-[12.5px] leading-[1.5] text-fg-muted">
            {desc}
          </p>
          {/* Show the command on the step you still need to do. */}
          {active && (
            <div className="mt-2.5 flex items-center gap-2 rounded-[6px] border border-subtle bg-dark px-3 py-2">
              <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-[12px] leading-[1.6] text-fg">
                <span className="text-fg-disabled">$ </span>
                {command}
              </code>
              <CopyButton
                value={command}
                iconOnly
                size="sm"
                ariaLabel="Copy command"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
