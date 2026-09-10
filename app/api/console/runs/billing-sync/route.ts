import { configuredPymthouseScope } from "@/lib/external-accounts/service";
import { fetchAccountRequestsForExternalUser } from "@/lib/console/pymthouse-bff";
import { sanitizeBillingReceipt } from "@/lib/console/billing-receipts";
import { requireConsoleSession } from "@/lib/console/session-user";
import {
  ownedRunsByIds,
  recordRunUsage,
  resolveRunOwner,
} from "@/lib/runs/store";
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
    const owned = await ownedRunsByIds(owner, body.runIds as string[]);
    const wanted = new Set(owned.map((run) => run.gatewayRequestId));
    const appId = configuredPymthouseScope().appId;
    const receipts = [];
    let cursor: string | null | undefined;

    // The API is newest-first. Bound work while allowing visible current-month
    // runs to be found beyond the first page.
    for (let page = 0; page < 10 && wanted.size; page += 1) {
      const payload = await fetchAccountRequestsForExternalUser({
        externalUserId: session.externalUserId,
        email: session.email,
        cursor,
        limit: 50,
        recentWindow: true,
      });
      if (
        payload.externalUserId !== session.externalUserId ||
        payload.clientId !== appId
      )
        throw new Error("run_owner_mismatch");
      for (const item of payload.items) {
        if (
          item.externalUserId !== session.externalUserId ||
          item.clientId !== appId ||
          !wanted.has(item.gatewayRequestId)
        )
          continue;
        const receipt = sanitizeBillingReceipt(item);
        if (receipt) receipts.push(receipt);
      }
      if (!payload.nextCursor || payload.nextCursor === cursor) break;
      cursor = payload.nextCursor;
    }

    const changedRunIds = await recordRunUsage(owner, receipts);
    return Response.json(
      { changedRunIds, changedCount: changedRunIds.length },
      { headers: RUN_HEADERS }
    );
  } catch (error) {
    return runError(error);
  }
}
