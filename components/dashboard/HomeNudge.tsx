"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useMemo } from "react";
import {
  ACCOUNT_USAGE_SUMMARY,
  MOCK_RECENT_REQUESTS,
  MODELS,
} from "@/lib/dashboard/mock-data";

/**
 * HomeNudge — a single contextual suggestion below the activity table.
 *
 * Replaces the previous "Suggested capabilities / Browse by category /
 * Getting started" trio that lived on the home view. Discovery content
 * belongs on /explore — what the home view earns is *one* smart prompt
 * tailored to the user's current state.
 *
 * Priority of nudges (first match wins):
 * 1. Free tier almost gone → connect billing
 * 2. No realtime requests yet → try streaming inference
 * 3. Lots of activity but only one model used → suggest a complementary capability
 * 4. Default fallback → docs / quickstart
 */
export default function HomeNudge() {
  const nudge = useMemo(() => {
    const { freeTierUsed, freeTierLimit } = ACCOUNT_USAGE_SUMMARY;
    const freePct = (freeTierUsed / freeTierLimit) * 100;

    // 1. Free tier nudge — highest priority because it impacts the user's ability to keep building.
    if (freePct >= 80) {
      return {
        eyebrow: "Heads up",
        title: `You're at ${Math.round(freePct)}% of your free tier this month.`,
        body: "Connect a payment provider to keep scaling without limits.",
        cta: "Set up billing",
        href: "/dashboard/settings?tab=billing",
      };
    }

    // 2. Realtime — capability nudge for users who haven't tried streaming.
    const usedRealtime = MOCK_RECENT_REQUESTS.some((r) =>
      MODELS.find((m) => m.name === r.model)?.realtime,
    );
    if (!usedRealtime) {
      const realtimeModel = MODELS.find((m) => m.realtime && m.featured);
      if (realtimeModel) {
        return {
          eyebrow: "Try this",
          title: "Streaming inference is faster for live applications.",
          body: `Sub-second latency over WebRTC. Start with ${realtimeModel.name}.`,
          cta: "Open playground",
          href: `/dashboard/models/${realtimeModel.id}`,
        };
      }
    }

    // 3. Single-model usage — surface a different capability.
    const distinctModels = new Set(MOCK_RECENT_REQUESTS.map((r) => r.model));
    if (distinctModels.size <= 2) {
      const next = MODELS.find(
        (m) => m.featured && !distinctModels.has(m.name),
      );
      if (next) {
        return {
          eyebrow: "Try this",
          title: `${next.name} pairs well with what you're building.`,
          body: next.description,
          cta: "Open playground",
          href: `/dashboard/models/${next.id}`,
        };
      }
    }

    // Default — point new builders to docs.
    return {
      eyebrow: "Tip",
      title: "Stream over WebRTC for sub-second latency.",
      body: "The realtime API is documented under Quickstart → Streaming inference.",
      cta: "Read the docs",
      href: "https://docs.livepeer.org",
    };
  }, []);

  const isExternal = nudge.href.startsWith("http");

  const inner = (
    <>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-fg-label">
          {nudge.eyebrow}
        </p>
        <p className="mt-1 text-sm text-fg-strong">{nudge.title}</p>
        <p className="mt-0.5 text-[13px] text-fg-faint">{nudge.body}</p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 self-end text-[13px] text-fg-muted transition-colors group-hover:text-fg sm:self-center">
        {nudge.cta}
        <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
      </span>
    </>
  );

  // Typography-only zone, hairline above. Linear pattern: the page closes
  // with a quiet typographic note, not another card.
  const className =
    "group flex flex-col gap-3 border-t border-hairline pt-6 transition-colors sm:flex-row sm:items-center sm:gap-6";

  if (isExternal) {
    return (
      <a
        href={nudge.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {inner}
      </a>
    );
  }

  return (
    <Link href={nudge.href} className={className}>
      {inner}
    </Link>
  );
}
