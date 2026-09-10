import { listOwnRuns } from "@/lib/runs/store";
import {
  ensurePreviewRunFixtures,
  previewFixturesEnabled,
  withoutLegacyPreviewFixtures,
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
    const preview = previewFixturesEnabled();
    if (preview)
      await ensurePreviewRunFixtures(owner, new URL(request.url).origin);
    const page = await listOwnRuns(owner, parseRunQuery(request.url));
    return Response.json(preview ? withoutLegacyPreviewFixtures(page) : page, {
      headers: RUN_HEADERS,
    });
  } catch (error) {
    return runError(error);
  }
}
