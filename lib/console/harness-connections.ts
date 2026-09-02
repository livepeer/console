"use client";

import { useEffect, useState } from "react";
import { MCP_SERVER_URL } from "@/lib/constants";

/**
 * The agent harnesses the pilot cares about people connecting.
 *
 * Vocabulary: in code these are harnesses (the team's word). In the UI they
 * are AGENT RUNTIMES — Adam's call. It is what an MCP host actually is, and
 * it collides with nothing: "harness" is jargon a creator won't recognise,
 * bare "agent" is the product they connect to (Livepeer Agent), and "app" is
 * what this console already calls a capability. The direction in copy is
 * always "add Livepeer Agent TO the runtime" — the runtime is the host.
 *
 * Order is deliberate — Claude first because it's the one most creators
 * already have, then Codex, then Hermes.
 */
export type HarnessId = "claude" | "codex" | "hermes";

export type Harness = {
  id: HarnessId;
  name: string;
  /** What the person does, in their own terms. */
  blurb: string;
  /** How the step is delivered: a shell command, or a prompt to paste. */
  kind: "command" | "prompt";
  /** The exact text to copy. */
  snippet: string;
  /**
   * The caption under the snippet: what to do with it, in the person's
   * words — the verb and the destination. Reads as a figure caption, which
   * is why it sits below the block rather than above it.
   */
  caption: string;
};

/**
 * The prompts are one sentence on purpose. An earlier draft told Codex to add
 * the server "to your MCP configuration over HTTP" — instructions the agent
 * doesn't need and the person doesn't understand, which cost 60 characters
 * and a line of wrapping for nothing.
 */
export const HARNESSES: Harness[] = [
  {
    id: "claude",
    name: "Claude Code",
    blurb: "Add the connector from your terminal.",
    kind: "command",
    snippet: `claude mcp add --transport http livepeer ${MCP_SERVER_URL}`,
    caption:
      "Run this in your terminal, then /mcp inside Claude Code to finish signing in.",
  },
  {
    id: "codex",
    name: "Codex",
    blurb: "Paste this and let Codex wire it up.",
    kind: "prompt",
    snippet: `Add the Livepeer Agent MCP server at ${MCP_SERVER_URL} and sign in when the browser opens.`,
    caption: "Paste this into Codex.",
  },
  {
    id: "hermes",
    // "Hermes Agent" is the runtime; "Hermes 4" is the model. Nous Research's
    // own navigation keeps them apart, and the row is the runtime.
    name: "Hermes Agent",
    blurb: "Paste this into a new session.",
    kind: "prompt",
    snippet: `Connect to the Livepeer Agent MCP server at ${MCP_SERVER_URL} and sign in when the browser opens.`,
    caption: "Paste this into Hermes Agent.",
  },
];

export type HarnessConnection = {
  connected: boolean;
  /** ISO timestamp of the most recent call through this harness, if any. */
  lastSeen: string | null;
};

export type HarnessConnectionState =
  | { status: "loading" }
  | { status: "ready"; connections: Record<HarnessId, HarnessConnection> };

const DISCONNECTED: Record<HarnessId, HarnessConnection> = {
  claude: { connected: false, lastSeen: null },
  codex: { connected: false, lastSeen: null },
  hermes: { connected: false, lastSeen: null },
};

/**
 * Whether each harness has connected, and when it was last used.
 *
 * NOT WIRED YET — this resolves to all-disconnected after a tick, which is the
 * correct starting state for every pilot user anyway: nobody has connected
 * anything until they do. An unlit row is the nudge.
 *
 * The real signal has to come from the server. The MCP OAuth exchange is the
 * only place that knows which client authenticated: `/api/v1/auth/mcp/begin`
 * currently passes `state` and `redirect_uri` straight through without
 * recording the client, so nothing persists a per-harness connection today.
 *
 * To wire it up, replace the body with a fetch of an endpoint that reports,
 * per harness, whether a token was ever minted for this account and when it
 * was last used, and map it onto `HarnessConnection`. Everything downstream —
 * the lit row, the dot, the "Connected · last call 2h ago" line — already
 * renders off this shape, so no component changes are needed.
 *
 * Identifying *which* harness minted a token is the open design question for
 * that endpoint: the OAuth client id is the natural key, and it needs to be
 * captured at `/begin` and stored with the mint.
 */
export function useHarnessConnections(): HarnessConnectionState {
  const [state, setState] = useState<HarnessConnectionState>({
    status: "loading",
  });

  useEffect(() => {
    // Placeholder for the fetch described above. Resolving on a microtask
    // keeps the loading → ready transition real, so the skeleton path stays
    // exercised until the endpoint lands behind it.
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) setState({ status: "ready", connections: DISCONNECTED });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
