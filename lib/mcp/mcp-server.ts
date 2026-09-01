import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { describeNetworkCapability, listNetworkCapabilities } from "./discovery";
import { isSlowCapability, runInference } from "./gateway";
import type { McpPrincipal } from "./jwt";
import { fetchMcpUsage } from "./pymthouse-spend";
import { assertSpendable } from "./pymthouse-usage";
import {
  cancelJob,
  forgetAssets,
  getJob,
  listAssets,
  putJob,
  rememberAsset,
} from "./store";
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
        "List network capabilities available on Livepeer live-runners. Use exact names with run_capability.",
      inputSchema: {},
    },
    async () => text({ capabilities: await listNetworkCapabilities() }),
  );

  server.registerTool(
    "describe_capability",
    {
      description: "Describe one capability by exact name or model_id.",
      inputSchema: {
        name: z.string().min(1),
      },
    },
    async ({ name }) => {
      const row = await describeNetworkCapability(name);
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
      const row = await describeNetworkCapability(name);
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
    "get_create_media",
    {
      description: "Poll an async run_capability job by job_id.",
      inputSchema: { job_id: z.string().min(1) },
    },
    async ({ job_id }) => {
      const job = getJob(job_id);
      if (!job) return text({ error: "not_found", job_id }, true);
      return text(job);
    },
  );

  server.registerTool(
    "cancel_job",
    {
      description: "Mark a running job cancelled (best-effort; in-flight inference may still finish).",
      inputSchema: { job_id: z.string().min(1) },
    },
    async ({ job_id }) => {
      const job = cancelJob(job_id);
      if (!job) return text({ error: "not_found", job_id }, true);
      return text(job);
    },
  );

  server.registerTool(
    "run_capability",
    {
      description:
        "Deterministic passthrough: name a Livepeer capability and pass its exact inputs. Slow video jobs return a job_id; poll with get_create_media.",
      inputSchema: {
        capability: z.string().min(1),
        inputs: z.record(z.unknown()).optional(),
        prompt: z.string().optional(),
        async: z.boolean().optional(),
      },
    },
    async ({ capability, inputs, prompt, async: asyncFlag }) => {
      try {
        assertSpendable(await fetchMcpUsage(principal));
      } catch (err) {
        return text(err instanceof Error ? err.message : String(err), true);
      }

      const wantAsync = asyncFlag === true || isSlowCapability(capability);
      if (wantAsync) {
        const jobId = newId("job");
        putJob({
          id: jobId,
          status: "running",
          capability,
          createdAt: new Date().toISOString(),
        });
        void (async () => {
          try {
            const result = await runInference(principal, {
              capability,
              params: (inputs as Record<string, unknown> | undefined) ?? {},
              prompt,
            });
            const current = getJob(jobId);
            if (current?.status === "cancelled") return;
            putJob({
              id: jobId,
              status: "succeeded",
              capability,
              url: result.url ?? result.imageUrl ?? result.videoUrl ?? result.audioUrl ?? undefined,
              createdAt: current?.createdAt ?? new Date().toISOString(),
            });
            if (result.url) {
              rememberAsset(pid, {
                id: newId("asset"),
                url: result.url,
                capability,
                createdAt: new Date().toISOString(),
              });
            }
          } catch (err) {
            putJob({
              id: jobId,
              status: "failed",
              capability,
              error: err instanceof Error ? err.message : String(err),
              createdAt: new Date().toISOString(),
            });
          }
        })();
        return text({
          job_id: jobId,
          status: "running",
          poll: "get_create_media",
          capability,
        });
      }

      try {
        const result = await runInference(principal, {
          capability,
          params: (inputs as Record<string, unknown> | undefined) ?? {},
          prompt,
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
