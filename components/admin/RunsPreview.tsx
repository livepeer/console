"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import SectionHeader from "@/components/console/SectionHeader";
import CallsTable from "@/components/console/CallsTable";
import type { AccountActivityRow } from "@/lib/console/types";
import CallDetailDrawer from "@/components/console/CallDetailDrawer";

// Presentation fixtures only. No API calls, execution, credentials, or customer data.
const sampleRuns = [
  {
    id: "demo-run-008",
    user: "alex@example.com",
    model: "Image generation",
    source: "Console",
    status: "Running",
    time: "14:32:08",
    duration: null,
    input: {
      prompt: "A sunlit studio with plants and oak furniture",
      width: 1024,
      height: 1024,
      seed: 42,
    },
    output: null,
  },
  {
    id: "demo-run-007",
    user: "jamie@example.com",
    model: "Speech to text",
    source: "MCP",
    status: "Completed",
    time: "14:31:54",
    duration: "3.2s",
    input: { audio: "sample-interview.wav", language: "en", timestamps: true },
    output: {
      text: "Welcome to our demonstration of the production workflow.",
      language: "en",
    },
  },
  {
    id: "demo-run-006",
    user: "morgan@example.com",
    model: "Video generation",
    source: "API",
    status: "Failed",
    time: "14:31:39",
    duration: "30.0s",
    input: {
      prompt: "A slow camera move through a forest",
      duration_seconds: 5,
      aspect_ratio: "16:9",
    },
    output: {
      error: {
        code: "upstream_timeout",
        message: "The sample upstream request timed out.",
      },
    },
  },
  {
    id: "demo-run-005",
    user: "alex@example.com",
    model: "Text generation",
    source: "MCP",
    status: "Completed",
    time: "14:31:22",
    duration: "1.4s",
    input: {
      messages: [
        { role: "user", content: "Write a short caption for a sunrise film." },
      ],
      temperature: 0.7,
      max_tokens: 120,
    },
    output: {
      text: "A new day, one frame at a time.",
      usage: { input_tokens: 14, output_tokens: 11 },
    },
  },
  {
    id: "demo-run-004",
    user: "riley@example.com",
    model: "Image upscale",
    source: "Console",
    status: "Queued",
    time: "14:31:10",
    duration: null,
    input: { image: "sample-landscape.png", scale: 4 },
    output: null,
  },
  {
    id: "demo-run-003",
    user: "jamie@example.com",
    model: "Text to speech",
    source: "API",
    status: "Completed",
    time: "14:30:58",
    duration: "2.1s",
    input: {
      text: "This is a fictional voiceover for a product walkthrough.",
      voice: "sample-narrator",
      speed: 1,
    },
    output: { audio: "sample-voiceover.wav", duration_seconds: 4.8 },
  },
  {
    id: "demo-run-002",
    user: "riley@example.com",
    model: "Image generation",
    source: "API",
    status: "Completed",
    time: "14:30:41",
    duration: "6.8s",
    input: {
      prompt: "Minimal monochrome poster for a film festival",
      width: 768,
      height: 1024,
    },
    output: { image: "sample-poster.png", width: 768, height: 1024 },
  },
  {
    id: "demo-run-001",
    user: "morgan@example.com",
    model: "Text generation",
    source: "Console",
    status: "Completed",
    time: "14:30:12",
    duration: "0.9s",
    input: {
      messages: [
        {
          role: "user",
          content: "Summarize the steps in a video editing workflow.",
        },
      ],
      max_tokens: 200,
    },
    output: {
      text: "Import footage, assemble a rough cut, refine audio and color, then export.",
      usage: { input_tokens: 18, output_tokens: 21 },
    },
  },
];
const presentations = [
  ["FLUX.1 Schnell", "text-to-image", "—"],
  ["Whisper large-v3", "speech-to-text", "$0.0032"],
  ["Wan 2.1", "text-to-video", "—"],
  ["Llama 3.3 70B", "text-generation", "$0.0004"],
  ["Real-ESRGAN", "image-to-image", "—"],
  ["Kokoro", "text-to-speech", "$0.0011"],
  ["FLUX.1 Schnell", "text-to-image", "$0.0048"],
  ["Llama 3.3 70B", "text-generation", "$0.0003"],
];
const statuses = ["All runs", "Completed", "In progress", "Failed"] as const;
type StatusFilter = (typeof statuses)[number];
function matchesStatus(run: (typeof sampleRuns)[number], status: StatusFilter) {
  return (
    status === "All runs" ||
    (status === "In progress"
      ? run.status === "Running" || run.status === "Queued"
      : run.status === status)
  );
}

export default function RunsPreview() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("All runs");
  const [expanded, setExpanded] = useState<string | null>(null);
  // Anchor fictional samples to this mount so Home's relative-time rendering
  // stays useful without claiming a real, connected live feed.
  const [sampleNow] = useState(() => Date.now());
  const rows = sampleRuns.filter(
    (run) =>
      matchesStatus(run, status) &&
      `${run.id} ${run.model} ${presentations[sampleRuns.indexOf(run)].join(" ")} ${run.user} ${JSON.stringify(run.input)}`
        .toLowerCase()
        .includes(query.trim().toLowerCase())
  );
  const activityRows: AccountActivityRow[] = rows.map((run) => {
    const index = sampleRuns.indexOf(run);
    const presentation = presentations[index];
    return {
      id: run.id,
      environmentId: "sample",
      timestamp: new Date(sampleNow - (index * 120 + 30) * 1000).toISOString(),
      model: presentation[0],
      pipeline: presentation[1],
      costDisplay: presentation[2],
      status:
        run.status === "Completed"
          ? "success"
          : run.status === "Failed"
            ? "failed"
            : "active",
      kind: "batch",
      latencyMs: run.duration ? parseFloat(run.duration) * 1000 : null,
      durationMs: null,
      signer: "paymthouse",
      signerLabel: run.source,
      tokenId: "sample",
      tokenName: "Fictional request",
    };
  });
  return (
    <section className="mt-8" aria-label="History preview">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-8 min-[480px]:grid-cols-2 xl:grid-cols-4">
        {statuses.map((value, index) => (
          <div key={value}>
            <dt className="whitespace-nowrap text-xs text-fg-muted">
              {index === 0 ? "Total runs" : value}
            </dt>
            <dd className="mt-2 text-3xl font-light tabular-nums">
              {sampleRuns.filter((run) => matchesStatus(run, value)).length}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-10">
        <SectionHeader
          variant="default"
          title="Platform History"
          className="mb-4 flex flex-wrap items-end justify-between gap-3"
          action={
            <label className="flex h-[26px] w-[240px] items-center gap-1.5 rounded-[4px] border border-hairline bg-dark px-2.5 focus-within:ring-1 focus-within:ring-green-bright/30">
              <Search
                className="h-3 w-3 shrink-0 text-fg-faint"
                aria-hidden="true"
              />
              <input
                aria-label="Search runs"
                placeholder="Search email, model or inputs…"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setExpanded(null);
                }}
                className="min-w-0 flex-1 bg-transparent text-[11.5px] text-fg-strong placeholder:text-fg-faint outline-none"
              />
            </label>
          }
        />
        <span role="status" className="sr-only">
          {rows.length} sample runs
        </span>
        <div
          role="group"
          aria-label="Filter runs by status"
          className="flex flex-wrap items-center gap-5 border-b border-hairline"
        >
          {statuses.map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={status === value}
              onClick={() => setStatus(value)}
              className={`-mb-px inline-grid shrink-0 border-b-2 px-3 pb-2.5 pt-1 text-[12.5px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${status === value ? "border-foreground font-medium text-fg-strong" : "border-transparent text-fg-faint hover:text-fg"}`}
            >
              {/* Keep neighboring filters still when the selected label gets heavier. */}
              <span
                aria-hidden="true"
                className="invisible col-start-1 row-start-1 whitespace-nowrap font-medium"
              >
                {value}
              </span>
              <span className="col-start-1 row-start-1 whitespace-nowrap">
                {value}
              </span>
            </button>
          ))}
        </div>
        <section aria-label="Platform history" className="-mx-5 mt-4 sm:-mx-7">
          <CallsTable
            rows={activityRows}
            bordered={false}
            density="cozy"
            variant="requests"
            rowContext={(row) => (
              <span className="ml-auto min-w-0 truncate text-[11.5px] font-normal text-fg-faint">
                {sampleRuns.find((run) => run.id === row.id)?.user}
              </span>
            )}
            onSelectRow={(row) => setExpanded(row.id)}
          />
          {!rows.length && (
            <p className="px-5 py-12 text-center text-sm text-fg-faint">
              No sample runs match these filters.
            </p>
          )}
        </section>
      </div>
      <CallDetailDrawer
        row={activityRows.find((row) => row.id === expanded) ?? null}
        rows={activityRows}
        open={activityRows.some((row) => row.id === expanded)}
        onClose={() => setExpanded(null)}
        onSelectRow={(row) => setExpanded(row.id)}
      />
    </section>
  );
}
