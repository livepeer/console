"use client";

import { useState } from "react";
import { Check, Key } from "lucide-react";
import CopyButton from "@/components/dashboard/CopyButton";
import { MODELS, STARTER_API_KEY } from "@/lib/dashboard/mock-data";

export const FIRST_RUN_DISMISSED_KEY = "livepeer.firstRunDismissed";
/** Fired in-tab whenever the dismissal flag changes (storage events only fire
 *  across tabs). Listened to by /dashboard so Quickstart re-opens the checklist. */
export const FIRST_RUN_CHANGED_EVENT = "livepeer:firstrun-changed";
const FLAGSHIP_MODEL_ID = "daydream-video";

type Lang = "curl" | "node" | "python" | "http";
type StepState = "done" | "active" | "pending";

interface Step {
  title: string;
  desc: string;
  state: StepState;
}

interface Props {
  /** Called when user dismisses (Skip). Parent flips Home back to standard view. */
  onDismiss: () => void;
}

function StepRow({ step, num }: { step: Step; num: number }) {
  const isDone = step.state === "done";
  const isActive = step.state === "active";
  return (
    <div
      className={`relative grid grid-cols-[22px_1fr] gap-2.5 rounded-md p-2 ${
        isActive ? "bg-dark-card" : ""
      }`}
    >
      {/* connecting line */}
      {num > 1 && (
        <span
          aria-hidden="true"
          className="absolute left-[19px] top-[-4px] h-3.5 w-px bg-tint"
        />
      )}
      <span
        className={`grid h-[22px] w-[22px] place-items-center rounded-full font-mono text-[11px] ${
          isDone
            ? "border border-green-light bg-green text-white"
            : isActive
              ? "border border-green-bright text-green-bright"
              : "border border-subtle text-fg-faint"
        }`}
        aria-hidden="true"
      >
        {isDone ? <Check className="h-3 w-3" strokeWidth={3} /> : num}
      </span>
      <div className="min-w-0">
        <p
          className={`text-[13px] font-medium ${
            isDone ? "text-fg-strong" : "text-fg"
          }`}
        >
          {step.title}
        </p>
        <p className="mt-px text-[12px] text-fg-faint">{step.desc}</p>
      </div>
    </div>
  );
}

function buildSnippet(lang: Lang, token: string): React.ReactNode {
  const C = (cls: string, children: React.ReactNode) => (
    <span className={cls}>{children}</span>
  );
  // Syntax colours route through theme-aware tokens — `text-green-bright` and
  // `text-blue-bright` already step down in light mode (globals.css), and
  // `--token-syntax-string` flips from mint (#6dfbb1) on dark to green-600
  // (#16a34a) on light so strings stay legible on a near-white code panel.
  const comment = "text-fg-disabled";
  const prompt = "text-green-bright";
  const cmd = "text-fg font-medium";
  const flag = "text-blue-bright";
  const str = "text-[color:var(--token-syntax-string)]";
  const key = "text-green-bright";
  const url = `https://api.livepeer.org/v1/stream/start`;
  const body = `'{"model":"daydream/video","prompt":"cinematic"}'`;

  if (lang === "curl") {
    return (
      <>
        {C(comment, "# Real-time style transfer over WebRTC")}
        {"\n"}
        {C(prompt, "$ ")}
        {C(cmd, "curl")} {C(flag, "-X")} POST {url} \{"\n"}
        {"    "}
        {C(flag, "-H")} {C(str, '"Authorization: Bearer ')}
        {C(key, token)}
        {C(str, '"')} \{"\n"}
        {"    "}
        {C(flag, "-H")} {C(str, '"Content-Type: application/json"')} \{"\n"}
        {"    "}
        {C(flag, "-d")} {C(str, body)}
        {"\n"}
      </>
    );
  }
  if (lang === "node") {
    return (
      <>
        {C(comment, "// Real-time style transfer over WebRTC")}
        {"\n"}
        {C(cmd, "const")} response = {C(cmd, "await")} fetch({C(str, `"${url}"`)}, {"{"}{"\n"}
        {"  "}method: {C(str, '"POST"')},{"\n"}
        {"  "}headers: {"{ "}
        {C(str, '"Authorization"')}: {C(str, '"Bearer ')}
        {C(key, token)}
        {C(str, '"')} {"}"},{"\n"}
        {"  "}body: JSON.stringify({"{"} model: {C(str, '"daydream/video"')} {"}"})
        {"\n"}
        {"}"});{"\n"}
      </>
    );
  }
  if (lang === "python") {
    return (
      <>
        {C(comment, "# Real-time style transfer over WebRTC")}
        {"\n"}
        {C(cmd, "import")} requests{"\n\n"}
        requests.post({"\n"}
        {"    "}
        {C(str, `"${url}"`)},{"\n"}
        {"    "}headers={"{"}
        {C(str, '"Authorization"')}: {C(str, '"Bearer ')}
        {C(key, token)}
        {C(str, '"')}
        {"}"},{"\n"}
        {"    "}json={"{"}
        {C(str, '"model"')}: {C(str, '"daydream/video"')}
        {"}"},{"\n"}
        ){"\n"}
      </>
    );
  }
  return (
    <>
      {C(cmd, "POST")} {url} HTTP/1.1{"\n"}
      Host: api.livepeer.org{"\n"}
      Authorization: Bearer {C(key, token)}
      {"\n"}
      Content-Type: application/json{"\n\n"}
      {body}
    </>
  );
}

/**
 * FirstRunChecklist — 2-column quickstart per the Livepeer Console design.
 * Left: 4-step linear flow (account → key → first call → payment).
 * Right: language-tabbed code panel with the user's starter token already
 * injected, plus a footer showing the key prefix with copy.
 */
export default function FirstRunChecklist({ onDismiss }: Props) {
  const [lang, setLang] = useState<Lang>("curl");
  const flagship = MODELS.find((m) => m.id === FLAGSHIP_MODEL_ID) ?? MODELS[0];

  const tokenPrefix = STARTER_API_KEY.prefix;
  const tokenSuffix = "m9p3";
  const fullToken = `${tokenPrefix}_demo_${tokenSuffix}`;

  const steps: Step[] = [
    {
      title: "Create your account",
      desc: "Signed in",
      state: "done",
    },
    {
      title: "Get your API key",
      desc: `${tokenPrefix}…${tokenSuffix} · ready to use`,
      state: "done",
    },
    {
      title: "Run your first inference",
      desc: `Try ${flagship.name} or paste this curl into your terminal →`,
      state: "active",
    },
    {
      title: "Connect a payment provider",
      desc: "Scale beyond 10,000 requests/month",
      state: "pending",
    },
  ];

  return (
    <section
      aria-label="Quickstart"
      className="grid grid-cols-1 overflow-hidden rounded-md border border-hairline bg-dark-lighter shadow-card lg:grid-cols-[1fr_1.1fr]"
    >
      {/* LEFT — steps. Header handled by the outer <SectionHeader>. */}
      <div className="flex flex-col gap-1 border-b border-hairline p-4 lg:border-b-0 lg:border-r">
        {steps.map((step, i) => (
          <StepRow key={step.title} step={step} num={i + 1} />
        ))}
      </div>

      {/* RIGHT — code panel */}
      <div className="flex flex-col bg-dark">
        {/* Language tabs */}
        <div className="flex gap-0.5 border-b border-hairline px-2 pt-2">
          {(["curl", "node", "python", "http"] as Lang[]).map((l) => {
            const active = lang === l;
            return (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={`rounded-t-md px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.05em] transition-colors ${
                  active
                    ? "border border-b-transparent border-hairline bg-dark-lighter text-fg-strong -mb-px"
                    : "text-fg-faint hover:text-fg-strong"
                }`}
              >
                {l}
              </button>
            );
          })}
        </div>

        {/* Code body */}
        <pre className="scrollbar-dark flex-1 overflow-x-auto whitespace-pre-wrap p-4 font-mono text-[11.5px] leading-[1.65] text-fg-strong">
          {buildSnippet(lang, fullToken)}
        </pre>

        {/* Footer with key + copy. Per the Livepeer Console design (Apr 2026):
            key prefix on the left, Copy on the right — no extra CTA. */}
        <div className="flex items-center gap-2 border-t border-hairline bg-dark-lighter px-3.5 py-2.5">
          <Key className="h-3 w-3 shrink-0 text-fg-faint" aria-hidden="true" />
          <span className="flex-1 truncate font-mono text-[11.5px] text-fg-strong">
            <span className="text-green-bright">{tokenPrefix}</span>
            <span className="text-fg-disabled">···············</span>
            <span>{tokenSuffix}</span>
          </span>
          <CopyButton
            value={fullToken}
            label="Copy"
            ariaLabel="Copy starter token"
            size="sm"
          />
        </div>
      </div>
    </section>
  );
}
