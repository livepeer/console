"use client";

import {
  formatPendingCancelDate,
  toDateInputValue,
  type SubscriptionTimingChoice,
  type SubscriptionTimingOptions,
} from "@/lib/dashboard/billing-subscription-state";

export default function TimingChoicePanel(props: {
  title: string;
  description: string;
  options: SubscriptionTimingOptions | null | undefined;
  choice: SubscriptionTimingChoice;
  customDate: string;
  confirmLabel: string;
  busy: boolean;
  onChoice: (choice: SubscriptionTimingChoice) => void;
  onCustomDate: (ymd: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const min = toDateInputValue(props.options?.minEffectiveAt);
  const max = toDateInputValue(props.options?.maxEffectiveAt);
  return (
    <div className="p-5">
      <h2 className="text-base font-semibold text-fg">{props.title}</h2>
      <p className="mt-1 text-[13px] text-fg-muted">{props.description}</p>
      <div className="mt-4 space-y-2">
        {(
          [
            {
              id: "immediate" as const,
              label: "Immediately",
              hint: "Takes effect right away",
            },
            {
              id: "next_billing_cycle" as const,
              label: "End of current period",
              hint: props.options?.maxEffectiveAt
                ? formatPendingCancelDate(props.options.maxEffectiveAt)
                : "Keep access until the period ends",
            },
            {
              id: "custom" as const,
              label: "Pick a date",
              hint: min && max ? `${min} – ${max}` : "Choose a date in range",
            },
          ] as const
        ).map((opt) => (
          <label
            key={opt.id}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-hairline px-3 py-2.5 hover:bg-white/[0.02]"
          >
            <input
              type="radio"
              className="mt-1"
              name="timing-choice"
              checked={props.choice === opt.id}
              onChange={() => props.onChoice(opt.id)}
            />
            <span>
              <span className="block text-[13px] font-medium text-fg">
                {opt.label}
              </span>
              <span className="block text-[12px] text-fg-muted">{opt.hint}</span>
            </span>
          </label>
        ))}
      </div>
      {props.choice === "custom" ? (
        <input
          type="date"
          className="mt-3 w-full rounded-md border border-hairline bg-transparent px-3 py-2 text-[13px] text-fg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-green-bright/30"
          min={min || undefined}
          max={max || undefined}
          value={props.customDate}
          onChange={(e) => props.onCustomDate(e.target.value)}
        />
      ) : null}
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          className="rounded-md px-3 py-1.5 text-[12.5px] text-fg-muted hover:text-fg"
          onClick={props.onClose}
          disabled={props.busy}
        >
          Cancel
        </button>
        <button
          type="button"
          className="rounded-md bg-green-bright px-3 py-1.5 text-[12.5px] font-medium text-black disabled:opacity-50"
          disabled={
            props.busy || (props.choice === "custom" && !props.customDate)
          }
          onClick={props.onConfirm}
        >
          {props.busy ? "Working…" : props.confirmLabel}
        </button>
      </div>
    </div>
  );
}
