import type { McpPrincipal } from "./jwt";

export function logToolCall(input: {
  tool: string;
  capability?: string;
  outcome: "ok" | "reject" | "error" | "timeout" | "unauthorized";
  durationMs: number;
  usdEstimated?: number;
  principalHash: string;
  jobId?: string;
  clientClass?: string;
}): void {
  console.log(
    JSON.stringify({
      msg: "mcp.tool",
      ...input
    })
  );
}

export async function hashPrincipal(id: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(id)
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

export function clientClassFromHeaders(req: Request): string {
  const ua = (req.headers.get("user-agent") || "").toLowerCase();
  if (ua.includes("claude")) return "claude";
  if (ua.includes("hermes") || ua.includes("nous")) return "hermes";
  if (ua.includes("codex") || ua.includes("openai")) return "codex";
  if (ua.includes("chatgpt")) return "chatgpt";
  return "unknown";
}

export function principalId(principal: McpPrincipal): string {
  return principal.externalUserId || principal.sub;
}
