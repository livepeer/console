import { requireRunOwner, runError, RUN_HEADERS } from "@/lib/runs/http";
import {
  ensurePreviewRunFixtures,
  previewFixturesEnabled,
} from "@/lib/runs/preview-fixtures";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!previewFixturesEnabled())
      return new Response("Not found", { status: 404 });
    const owner = await requireRunOwner();
    return Response.json(
      await ensurePreviewRunFixtures(owner, new URL(request.url).origin),
      { headers: RUN_HEADERS }
    );
  } catch (error) {
    return runError(error);
  }
}
