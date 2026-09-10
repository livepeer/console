import { listOwnRuns } from "@/lib/runs/store";
import {
  ensurePreviewRunFixtures,
  previewFixturesEnabled,
} from "@/lib/runs/preview-fixtures";
import {
  parseRunQuery,
  requireRunOwner,
  runError,
  RUN_HEADERS,
} from "@/lib/runs/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const owner = await requireRunOwner();
    if (previewFixturesEnabled())
      await ensurePreviewRunFixtures(owner, new URL(request.url).origin);
    return Response.json(await listOwnRuns(owner, parseRunQuery(request.url)), {
      headers: RUN_HEADERS,
    });
  } catch (error) {
    return runError(error);
  }
}
