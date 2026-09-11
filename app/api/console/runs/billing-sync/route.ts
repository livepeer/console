import { requireConsoleSession } from "@/lib/console/session-user";
import { refreshOwnedRunBilling } from "@/lib/runs/manifest-billing";
import { resolveRunOwner } from "@/lib/runs/store";
import { runError, RUN_HEADERS } from "@/lib/runs/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { runIds?: unknown };
    if (
      !Array.isArray(body.runIds) ||
      body.runIds.length > 50 ||
      body.runIds.some((id) => typeof id !== "string" || !id || id.length > 160)
    )
      throw new Error("invalid_run_query");
    const session = await requireConsoleSession();
    const owner = await resolveRunOwner(session.externalUserId);
    if (owner.userId !== session.canonicalUserId)
      throw new Error("run_owner_mismatch");
    const result = await refreshOwnedRunBilling({
      owner,
      externalUserId: session.externalUserId,
      email: session.email,
      runIds: body.runIds,
    });
    return Response.json(
      {
        changedRunIds: result.changedRunIds,
        changedCount: result.changedRunIds.length,
        pending: result.pending,
      },
      { headers: RUN_HEADERS }
    );
  } catch (error) {
    return runError(error);
  }
}
