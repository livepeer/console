"use client";

import { Check } from "lucide-react";
import CopyButton from "@/components/console/CopyButton";
import { MOCK_RECENT_REQUESTS, STARTER_API_KEY } from "@/lib/console/mock-data";

export const FIRST_RUN_DISMISSED_KEY = "livepeer.firstRunDismissed";
/** Fired in-tab whenever the dismissal flag changes (storage events only fire
 *  across tabs). Listened to by /home so Quickstart re-opens the checklist. */
export const FIRST_RUN_CHANGED_EVENT = "livepeer:firstrun-changed";

interface Props {
  /** Called when the user finishes or skips. Parent flips Home to the standard view. */
  onDismiss: () => void;
}

/**
 * Prototype override. The demo org already has a key + recorded calls, so
 * auto-detection would mark every step done and the checklist would only ever
 * show its completed state. Forcing this keeps the onboarding loop visible in
 * the prototype. Set to `false` once real per-account state backs the steps.
 */
const MOCK_FORCE_ONBOARDING = true;

/**
 * FirstRunChecklist — the consumer's first loop in three steps: **create your
 * account → get your API key → call an app**. Step 1 completes the moment
 * you're signed in; the rest auto-detect from real state (you have a key ·
 * you've made a call) — no "I've done it" buttons. The active step shows the
 * command to run; finished steps check themselves off.
 */
export default function FirstRunChecklist({ onDismiss }: Props) {
  // You're signed in to see this, so the account step is already complete.
  const hasAccount = true;
  const hasKey = !MOCK_FORCE_ONBOARDING && Boolean(STARTER_API_KEY);
  const hasCall = !MOCK_FORCE_ONBOARDING && MOCK_RECENT_REQUESTS.length > 0;
  const allDone = hasAccount && hasKey && hasCall;

  const token = `${STARTER_API_KEY.prefix}_live_…`;
  const keyCmd = "livepeer keys create --name default";
  const callCmd = `curl https://api.livepeer.org/run/flux-schnell -H "Authorization: Bearer ${token}" -d '{"prompt":"a neon city at night"}'`;

  return (
    <section
      aria-label="Get started"
      className="overflow-hidden rounded-md border border-hairline bg-dark-lighter shadow-card"
    >
      <Step
        num={1}
        title="Create your account"
        desc="You're signed in — your organization is ready to go."
        done={hasAccount}
        active={!hasAccount}
        command=""
      />
      <Step
        num={2}
        title="Get your API key"
        desc="Mint a key to authenticate your requests — or grab one on the API keys page."
        done={hasKey}
        active={hasAccount && !hasKey}
        pending={!hasAccount}
        command={keyCmd}
      />
      <Step
        num={3}
        title="Call an app"
        desc="Send your first request to any app on the network and get a response back."
        done={hasCall}
        active={hasKey && !hasCall}
        pending={!hasKey}
        command={callCmd}
      />

      {allDone && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline bg-green/[0.05] px-4 py-3">
          <p className="inline-flex items-center gap-2 text-[13px] font-medium text-fg">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-green text-white">
              <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
            </span>
            You&apos;ve got a key and made your first call — you&apos;re all
            set.
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
