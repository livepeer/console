import { getOwnRun } from "@/lib/runs/store";
import { requireRunOwner, runError, RUN_HEADERS } from "@/lib/runs/http";
import {
  loadFalInputSchema,
  resolveFalCatalogEntry,
} from "@/lib/mcp/fal-input-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const owner = await requireRunOwner();
    const result = await getOwnRun(owner, (await context.params).id);
    if (!result) throw new Error("run_not_found");
    const catalog = resolveFalCatalogEntry(result);
    return Response.json(
      { inputSchema: catalog ? await loadFalInputSchema(catalog) : null },
      { headers: RUN_HEADERS }
    );
  } catch (error) {
    return runError(error);
  }
}
