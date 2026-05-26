"use client";

import { ArrowRight, Box, Check, Download, Plus } from "lucide-react";
import {
  IconButton,
  SettingsCard,
  SettingsField,
  SettingsHeader,
  SettingsInput,
  SettingsTextarea,
  ST_COLS_5,
  ST_HEAD_CLASS,
} from "./SettingsPrimitives";

/**
 * Workspace · Billing — `?tab=billing` per the v7 prototype.
 *
 * Four blocks:
 *  1. Plan — three plan cards side by side (Free, Pro, Scale)
 *  2. Payment method — empty state ("No payment method · Add a card…")
 *  3. Billing details — company / email / tax ID / address fields
 *  4. Invoices — table of historical invoices
 */
export default function BillingSection() {
  // Billing view is rendered behind a blur with a "Work in progress" notice
  // on top — reviewers can see the surface area without mistaking it for a
  // finalized flow. Real treatment is still being designed.
  return (
    <div className="relative">
      <div
        className="pointer-events-none select-none blur-sm"
        aria-hidden="true"
      >
      <SettingsHeader
        title="Plan"
        sub="You're on the free tier · 10,000 jobs/month"
      />

      <SettingsCard>
        <div className="grid grid-cols-1 md:grid-cols-3">
          {/* Free — current plan: 2px accent rail on the left + a vertical
              `rgba(64,191,134,0.06) → transparent` wash, per the v7
              prototype's `.plan-active` rule. The gradient subtly tints the
              top of the card so the "current plan" reads at a glance even
              before the eyebrow is parsed. */}
          <div
            className="relative border-b border-hairline p-[18px] md:border-b-0 md:border-r"
            style={{
              background:
                "linear-gradient(180deg, rgba(64, 191, 134, 0.06), transparent)",
            }}
          >
            <span
              className="absolute top-0 bottom-0 left-0 w-[2px] bg-green"
              aria-hidden="true"
            />
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-green-bright">
              Current plan
            </p>
            <p className="mt-1 text-[16px] font-medium text-fg">Free</p>
            <p className="mt-1 text-[13px] text-fg-strong">
              <span className="text-[22px] font-medium tracking-[-0.01em] text-fg">
                $0
              </span>
              <span className="text-fg-faint"> / month</span>
            </p>
            <ul className="mt-3.5 flex flex-col gap-1.5">
              {[
                "10,000 jobs / month",
                "3 concurrent streams",
                "5 GB storage retention",
                "Community support",
              ].map((line) => (
                <li
                  key={line}
                  className="flex items-center gap-1.5 text-[12.5px] text-fg-strong"
                >
                  <Check
                    className="h-3 w-3 shrink-0 text-green-bright"
                    aria-hidden="true"
                  />
                  {line}
                </li>
              ))}
            </ul>
          </div>

          {/* Pro — upgrade option */}
          <PlanCard
            name="Pro"
            price="$29"
            priceSub=" / month + usage"
            features={[
              "Unlimited jobs · pay-as-you-go",
              "25 concurrent streams",
              "100 GB storage retention",
              "Priority support · 24h SLA",
            ]}
            cta="Upgrade to Pro"
          />

          {/* Scale — enterprise */}
          <PlanCard
            name="Scale"
            price="Custom"
            priceSub=" · contact us"
            features={[
              "Reserved GPU pools",
              "Dedicated solutions engineer",
              "Single-tenant inference",
              "99.99% SLA",
            ]}
            cta="Talk to sales"
            ctaOutline
            isLast
          />
        </div>
      </SettingsCard>

      <SettingsHeader
        title="Payment method"
        sub="Card on file for usage above the free tier"
        action={
          <IconButton primary>
            <Plus className="h-3 w-3" aria-hidden="true" />
            Add card
          </IconButton>
        }
      />
      <SettingsCard>
        <div className="px-5 py-9 text-center">
          <Box
            className="mx-auto h-[22px] w-[22px] text-fg-disabled"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <p className="mt-2 text-[13.5px] font-medium text-fg">
            No payment method
          </p>
          <p className="mt-1 text-[12.5px] text-fg-faint">
            Add a card to keep capabilities running past the free quota.
          </p>
        </div>
      </SettingsCard>

      <SettingsHeader
        title="Billing details"
        sub="Used on invoices and receipts"
      />
      <SettingsCard>
        <SettingsField
          label="Company name"
          hint="Optional — appears on invoices."
        >
          <SettingsInput defaultValue="Flipbook, Inc." />
        </SettingsField>
        <SettingsField label="Billing email">
          <SettingsInput defaultValue="billing@flipbook.page" />
        </SettingsField>
        <SettingsField
          label="Tax ID"
          hint="VAT, GST, ABN — formatting depends on country."
        >
          <SettingsInput placeholder="Add tax ID" />
        </SettingsField>
        <SettingsField
          label="Billing address"
          hint="Used for tax calculation."
        >
          <SettingsTextarea
            rows={3}
            defaultValue={"2261 Market St #4090\nSan Francisco, CA 94114\nUnited States"}
          />
        </SettingsField>
      </SettingsCard>

      <SettingsHeader
        title="Invoices"
        action={
          <IconButton>
            <Download className="h-3 w-3" aria-hidden="true" />
            Download all
          </IconButton>
        }
      />
      <SettingsCard>
        <div className={`${ST_COLS_5} ${ST_HEAD_CLASS}`}>
          <span>Invoice</span>
          <span>Date</span>
          <span>Amount</span>
          <span>Description</span>
          <span aria-hidden="true" />
        </div>
        {[
          {
            id: "INV-2024-04",
            date: "Apr 1, 2025",
            amount: "$0.00",
            desc: "Free tier · 9,127 jobs",
          },
          {
            id: "INV-2024-03",
            date: "Mar 1, 2025",
            amount: "$0.00",
            desc: "Free tier · 4,820 jobs",
          },
          {
            id: "INV-2024-02",
            date: "Feb 1, 2025",
            amount: "$0.00",
            desc: "Free tier · 1,602 jobs",
          },
        ].map((inv) => (
          <div
            key={inv.id}
            className={`${ST_COLS_5} border-b border-hairline last:border-b-0 transition-colors hover:bg-zebra`}
          >
            <div className="font-mono text-[12.5px] text-fg">{inv.id}</div>
            <div className="text-[12.5px] text-fg-faint">{inv.date}</div>
            <div className="font-mono text-[12.5px] text-fg">{inv.amount}</div>
            <div className="text-[12px] text-fg-faint">{inv.desc}</div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="text-[12px] text-fg-strong transition-colors hover:text-fg"
              >
                View
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[12px] text-fg-strong transition-colors hover:text-fg"
              >
                <Download className="h-3 w-3" aria-hidden="true" />
                PDF
              </button>
            </div>
          </div>
        ))}
      </SettingsCard>
      </div>

      {/* WIP overlay — sits above the blurred content. Pointer-events-none
          on the wrapper so the blur layer below stays inert; the notice
          itself re-enables pointer-events so it's selectable text. */}
      <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-24">
        <div
          role="status"
          className="pointer-events-auto max-w-md rounded-md border border-subtle bg-dark-lighter px-6 py-5 text-center shadow-popover"
        >
          <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-fg-faint">
            Work in progress
          </p>
          <p className="mt-2 text-[15px] font-semibold tracking-[-0.005em] text-fg">
            Billing UX is not finalized
          </p>
          <p className="mt-1.5 text-[13px] leading-[1.5] text-fg-muted">
            This view is still in flux while we settle on the
            payment-provider model.
          </p>
        </div>
      </div>
    </div>
  );
}

function PlanCard({
  name,
  price,
  priceSub,
  features,
  cta,
  ctaOutline = false,
  isLast = false,
}: {
  name: string;
  price: string;
  priceSub: string;
  features: string[];
  cta: string;
  ctaOutline?: boolean;
  isLast?: boolean;
}) {
  return (
    <div
      className={`p-[18px] ${
        isLast ? "border-b-0" : "border-b border-hairline md:border-b-0"
      } ${isLast ? "" : "md:border-r border-hairline"}`}
    >
      <p className="text-[16px] font-medium text-fg">{name}</p>
      <p className="mt-1 text-[13px] text-fg-strong">
        <span className="text-[22px] font-medium tracking-[-0.01em] text-fg">
          {price}
        </span>
        <span className="text-fg-faint">{priceSub}</span>
      </p>
      <ul className="mt-3.5 flex flex-col gap-1.5">
        {features.map((line) => (
          <li
            key={line}
            className="flex items-center gap-1.5 text-[12.5px] text-fg-strong"
          >
            <Check
              className="h-3 w-3 shrink-0 text-green-bright"
              aria-hidden="true"
            />
            {line}
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={`mt-4 inline-flex h-7 items-center gap-1 rounded-[4px] border px-3 text-[12.5px] font-medium transition-colors ${
          ctaOutline
            ? "border-subtle bg-transparent text-fg hover:bg-hover"
            : "btn-primary"
        }`}
      >
        {cta}
        {!ctaOutline && (
          <ArrowRight className="h-2.5 w-2.5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
