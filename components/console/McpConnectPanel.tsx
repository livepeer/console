"use client";

import type { ReactNode } from "react";
import { Terminal, MessageSquare } from "lucide-react";
import CopyButton from "@/components/console/CopyButton";
import SectionHeader from "@/components/console/SectionHeader";
import StatusDot from "@/components/console/StatusDot";
import HarnessLogo from "@/components/console/HarnessLogo";
import McpMark from "@/components/console/McpMark";
import { formatRunRelativeTime } from "@/lib/console/utils";
import { MCP_SERVER_URL } from "@/lib/constants";
import {
  HARNESSES,
  useHarnessConnections,
  type Harness,
  type HarnessConnection,
} from "@/lib/console/harness-connections";

// ─── The endpoint, then the harnesses ──────────────────────────────────────
//
// Two cards, one anatomy. The endpoint is its own card directly under the
// intro paragraph that describes it — the intro is its header — and the
// three harnesses sit under "Your harnesses" on a rail. Both are built from
// the same row: a 28px node, a name line, a recessed block, so they read as
// one system without being one list.
//
// They were briefly one card, with the endpoint as the first row. Under a
// header that counts "0 of 3 harnesses connected", a fourth row reads as a
// harness whatever it contains — and no amount of indentation or contrast
// inside the card can overrule what the header above it says the card is.
// Scope is set by the header. The endpoint is out from under it.

/** Node diameter, and its centre from the card's left / a row's top edge. */
const NODE = 28;
const NODE_CENTER = 16 + NODE / 2; // card px-4 + radius = 30px

/**
 * The rail, drawn per row as two stubs meeting at the node's centre: one up
 * to the row's top edge, one down to its bottom. The first row has no "up",
 * the last no "down", so the line starts and ends exactly on a node centre
 * whatever height the rows are.
 */
function RailStubs({ isFirst, isLast }: { isFirst: boolean; isLast: boolean }) {
  const x = NODE_CENTER - 0.5;
  return (
    <>
      {!isFirst && (
        <span
          className="pointer-events-none absolute w-px bg-border-subtle"
          style={{ left: x, top: 0, height: NODE_CENTER }}
          aria-hidden="true"
        />
      )}
      {!isLast && (
        <span
          className="pointer-events-none absolute w-px bg-border-subtle"
          style={{ left: x, top: NODE_CENTER, bottom: 0 }}
          aria-hidden="true"
        />
      )}
    </>
  );
}

/**
 * A node on the rail. `lit` is full contrast; otherwise the mark sits dim.
 * `ring` and `badge` are the connected treatment — green ring, presence dot.
 */
function RailNode({
  lit,
  ring = false,
  badge,
  loading = false,
  children,
}: {
  lit: boolean;
  ring?: boolean;
  badge?: ReactNode;
  loading?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={`relative z-10 grid shrink-0 place-items-center rounded-full border bg-dark-card transition-colors duration-[var(--motion-duration-base)] ${
        ring ? "border-green-bright/40" : "border-subtle"
      } ${lit ? "text-fg" : "text-fg-muted"} ${
        loading ? "animate-pulse motion-reduce:animate-none" : ""
      }`}
      style={{ width: NODE, height: NODE }}
      aria-hidden="true"
    >
      {children}
      {badge}
    </span>
  );
}

/** A row: node at the left, a name line and content at the right. */
function RailRow({
  as: Tag = "li",
  rail,
  node,
  name,
  meta,
  children,
}: {
  /** `li` inside the harness list; `div` for the endpoint's single card. */
  as?: "li" | "div";
  /** Draw the rail through this row. Omit for a row that stands alone. */
  rail?: { isFirst: boolean; isLast: boolean };
  node: ReactNode;
  name: ReactNode;
  /** Right end of the name line — a chip, a stamp. */
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Tag className="relative flex gap-3.5 border-b border-hairline px-4 py-4 last:border-b-0">
      {rail && <RailStubs isFirst={rail.isFirst} isLast={rail.isLast} />}
      {node}
      <div className="min-w-0 flex-1">
        <div
          className="flex items-center justify-between gap-3"
          style={{ minHeight: NODE }}
        >
          <h3 className="flex items-center gap-2 text-[13.5px] font-medium text-fg">
            {name}
          </h3>
          {meta}
        </div>
        {children}
      </div>
    </Tag>
  );
}

/** The recessed field every copyable value on this card sits in. */
function CopyBlock({
  value,
  ariaLabel,
  glyph,
  size = "sm",
}: {
  value: string;
  ariaLabel: string;
  glyph?: ReactNode;
  /** `md` is the endpoint's one step up; `sm` is every command. */
  size?: "sm" | "md";
}) {
  return (
    <div className="mt-2 flex items-start gap-2.5 rounded-[6px] border border-subtle bg-dark px-3 py-2.5">
      {glyph}
      <code
        className={`min-w-0 flex-1 break-words font-mono text-fg-strong ${
          size === "md"
            ? "text-[14px] font-medium leading-[1.4] text-fg"
            : "text-[12px] leading-[1.55]"
        }`}
      >
        {value}
      </code>
      <CopyButton
        value={value}
        iconOnly
        size="xs"
        ariaLabel={ariaLabel}
        className="-mr-1 -mt-0.5 shrink-0"
      />
    </div>
  );
}

// ─── Rows ───────────────────────────────────────────────────────────────────

function EndpointRow() {
  return (
    <RailRow
      as="div"
      node={
        <RailNode lit>
          <McpMark className="h-4 w-4" strokeWidth={17} />
        </RailNode>
      }
      name={
        <>
          MCP endpoint
          {/* The transport is the one detail the Claude command needs
              (`--transport http`), so it's worth a chip. */}
          <span
            className="rounded-[3px] border border-hairline px-1.5 py-px font-mono text-[10px] font-normal uppercase tracking-[0.04em] text-fg-faint"
            title="Streamable HTTP transport"
          >
            http
          </span>
        </>
      }
    >
      <CopyBlock
        value={MCP_SERVER_URL}
        ariaLabel="Copy the MCP endpoint"
        size="md"
      />
      <p className="mt-2 max-w-xl text-[12px] leading-[1.5] text-fg-faint">
        Works with any agent runtime that speaks MCP. No API key to provision —
        the first connection opens a browser and signs you in with the email you
        used here.
      </p>
    </RailRow>
  );
}

function HarnessRow({
  harness,
  connection,
  loading,
  isFirst,
  isLast,
}: {
  harness: Harness;
  connection: HarnessConnection | null;
  loading: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  const connected = connection?.connected === true;
  const Icon = harness.kind === "command" ? Terminal : MessageSquare;

  return (
    <RailRow
      rail={{ isFirst, isLast }}
      node={
        <RailNode
          lit={connected}
          ring={connected}
          loading={loading}
          badge={
            connected ? (
              // Presence dot on the node's edge. The ring of card colour
              // around it is what makes it read as sitting *on* the circle.
              <span className="absolute -bottom-px -right-px grid place-items-center rounded-full bg-dark-lighter p-[2px]">
                <StatusDot tone="green" size="sm" />
              </span>
            ) : null
          }
        >
          <HarnessLogo
            id={harness.id}
            className={harness.id === "hermes" ? "h-4 w-4" : "h-3.5 w-3.5"}
          />
        </RailNode>
      }
      name={harness.name}
      meta={
        connected && connection ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 text-[11.5px] text-fg-muted">
            <span className="text-green-bright">Connected</span>
            {connection.lastSeen && (
              <>
                <span className="text-fg-disabled" aria-hidden="true">
                  ·
                </span>
                <span className="font-mono text-[11px] tabular-nums">
                  {formatRunRelativeTime(connection.lastSeen)}
                </span>
              </>
            )}
          </span>
        ) : undefined
      }
    >
      {connected ? (
        <p className="mt-1 text-[12.5px] leading-[1.5] text-fg-muted">
          Ask {harness.name} to generate something — Livepeer Agent answers.
        </p>
      ) : (
        <>
          {/* The box says "copy this"; the glyph says terminal or chat. */}
          <CopyBlock
            value={harness.snippet}
            ariaLabel={`Copy the ${harness.name} ${harness.kind}`}
            glyph={
              <Icon
                className="mt-px h-3.5 w-3.5 shrink-0 text-fg-disabled"
                aria-hidden="true"
              />
            }
          />
          <p className="mt-2 text-[12px] leading-[1.45] text-fg-faint">
            {harness.caption}
          </p>
        </>
      )}
    </RailRow>
  );
}

// ─── Panel ──────────────────────────────────────────────────────────────────

export default function McpConnectPanel() {
  const state = useHarnessConnections();
  const loading = state.status === "loading";
  const connections = state.status === "ready" ? state.connections : null;
  const connectedCount = connections
    ? HARNESSES.filter((h) => connections[h.id].connected).length
    : 0;

  return (
    <>
      {/* No header: the intro paragraph directly above is this card's lead. */}
      <div className="overflow-hidden rounded-md border border-hairline bg-dark-lighter shadow-card">
        <EndpointRow />
      </div>

      {/* The rule once, up top; the specific verb and destination sit under
          each block as a caption. The count is a count, so it goes where a
          count belongs — the header's right edge, in mono. */}
      <SectionHeader
        variant="default"
        className="mt-7 mb-3 flex items-end justify-between gap-3"
        title="Agent runtimes"
        description="Add Livepeer Agent to the runtimes you use — copy the line for yours and paste it in."
        action={
          <span className="font-mono text-[11px] tabular-nums text-fg-faint">
            {loading
              ? "Checking…"
              : connectedCount === HARNESSES.length
                ? "All connected"
                : `${connectedCount} of ${HARNESSES.length} connected`}
          </span>
        }
      />

      <ul className="overflow-hidden rounded-md border border-hairline bg-dark-lighter shadow-card">
        {HARNESSES.map((h, i) => (
          <HarnessRow
            key={h.id}
            harness={h}
            connection={connections ? connections[h.id] : null}
            loading={loading}
            isFirst={i === 0}
            isLast={i === HARNESSES.length - 1}
          />
        ))}
      </ul>
    </>
  );
}
