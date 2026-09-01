import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { describeNetworkCapability, listNetworkCapabilities } from "./discovery";
import { runInference } from "./gateway";
import type { McpPrincipal } from "./jwt";
import { fetchMcpUsage } from "./pymthouse-spend";
import { assertSpendable } from "./pymthouse-usage";
import { forgetAssets, listAssets, rememberAsset } from "./store";
import { principalId } from "./log";

function text(data: unknown, isError = false) {
  return {
    isError,
    content: [
      {
        type: "text" as const,
        text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

export function buildRawMcpServer(principal: McpPrincipal): McpServer {
  const pid = principalId(principal);
  const server = new McpServer({
    name: "Livepeer Agent MCP",
    version: "0.1.0",
    description:
      "Raw Livepeer MCP: name a capability, pass its exact inputs, get that capability. No planner.",
  });

  server.registerTool(
    "list_capabilities",
    {
      description:
        "List live-runner apps from the SignerSession discovery catalog. Use exact `name` (app id) with run_capability. `mode` is single-shot or persistent.",
      inputSchema: {},
    },
    async () => text({ capabilities: await listNetworkCapabilities(principal) }),
  );

  server.registerTool(
    "describe_capability",
    {
      description: "Describe one live-runner app by exact name from list_capabilities.",
      inputSchema: {
        name: z.string().min(1),
      },
    },
    async ({ name }) => {
      const row = await describeNetworkCapability(principal, name);
      if (!row) return text({ error: "not_found", name }, true);
      return text(row);
    },
  );

  server.registerTool(
    "get_pricing",
    {
      description: "Return discovery price metadata for a capability if present.",
      inputSchema: { name: z.string().min(1) },
    },
    async ({ name }) => {
      const row = await describeNetworkCapability(principal, name);
      if (!row) return text({ error: "not_found", name }, true);
      return text({ name: row.name, price: row.price ?? null });
    },
  );

  server.registerTool(
    "upload",
    {
      description:
        "This host does not store bytes. Pass a public https URL as source_url / image_url on run_capability.",
      inputSchema: { hint: z.string().optional() },
    },
    async () =>
      text({
        error: "pass_https_url",
        message:
          "Pass a publicly reachable https URL in run_capability inputs (image_url, source_url, audio_url). No local upload store on this MCP.",
      }),
  );

  server.registerTool(
    "upload_image",
    {
      description: "Alias of upload — pass a public https image URL to run_capability.",
      inputSchema: { hint: z.string().optional() },
    },
    async () =>
      text({
        error: "pass_https_url",
        message: "Pass image_url as a public https URL to run_capability.",
      }),
  );

  server.registerTool(
    "create_upload_url",
    {
      description: "Not available on this host. Use a public https URL.",
      inputSchema: {},
    },
    async () =>
      text({
        error: "pass_https_url",
        message: "create_upload_url is not hosted here. Host the file yourself and pass https.",
      }),
  );

  server.registerTool(
    "get_recent_assets",
    {
      description: "Assets produced in this isolate for the current principal.",
      inputSchema: {},
    },
    async () => text({ assets: listAssets(pid) }),
  );

  server.registerTool(
    "search_assets",
    {
      description: "Search recent assets by capability or URL substring.",
      inputSchema: { query: z.string().min(1) },
    },
    async ({ query }) => text({ assets: listAssets(pid, query) }),
  );

  server.registerTool(
    "forget_assets",
    {
      description: "Drop remembered assets for this principal (this isolate only).",
      inputSchema: { ids: z.array(z.string()).optional() },
    },
    async ({ ids }) => text({ forgotten: forgetAssets(pid, ids) }),
  );

  server.registerTool(
    "get_cost_report",
    {
      description:
        "Current UTC calendar day OpenMeter network-fee spend (00:00–23:59 UTC). hasAccess is the PymtHouse spendable hard limit.",
      inputSchema: {},
    },
    async () => {
      try {
        return text(await fetchMcpUsage(principal));
      } catch (err) {
        return text(err instanceof Error ? err.message : String(err), true);
      }
    },
  );

  server.registerTool(
    "me",
    {
      description: "Who this token is keyed as. console_access is unknown on this host (check Console).",
      inputSchema: {},
    },
    async () =>
      text({
        sub: principal.sub,
        external_user_id: principal.externalUserId,
        public_client_id: principal.publicClientId,
        email: principal.email ?? null,
        console_access: "unknown",
      }),
  );

  server.registerTool(
    "me_usage",
    {
      description:
        "Current UTC calendar day OpenMeter network-fee spend (00:00–23:59 UTC).",
      inputSchema: {},
    },
    async () => {
      try {
        return text(await fetchMcpUsage(principal));
      } catch (err) {
        return text(err instanceof Error ? err.message : String(err), true);
      }
    },
  );

  server.registerTool(
    "run_capability",
    {
      description:
        "Deterministic passthrough: name a Livepeer capability and pass its exact inputs. Blocks until the runner returns. If the host times out, retry the same call — there is no job_id to poll.",
      inputSchema: {
        capability: z.string().min(1),
        inputs: z.record(z.unknown()).optional(),
        prompt: z.string().optional(),
      },
    },
    async ({ capability, inputs, prompt }) => {
      try {
        assertSpendable(await fetchMcpUsage(principal));
      } catch (err) {
        return text(err instanceof Error ? err.message : String(err), true);
      }

      try {
        const result = await runInference(principal, {
          capability,
          params: (inputs as Record<string, unknown> | undefined) ?? {},
          prompt,
          timeoutMs: 780_000,
        });
        const url = result.url ?? result.imageUrl ?? result.videoUrl ?? result.audioUrl;
        if (url) {
          rememberAsset(pid, {
            id: newId("asset"),
            url,
            capability,
            createdAt: new Date().toISOString(),
          });
        }
        return text({
          capability,
          url,
          orchestrator: result.orchestrator,
          elapsed_ms: result.elapsedMs,
        });
      } catch (err) {
        return text(err instanceof Error ? err.message : String(err), true);
      }
    },
  );

  return server;
}
