import "server-only";

import type { SignedTicketRequestRow } from "@/lib/console/account-usage";

/**
 * Output joins need the early-access `mcp_assets` table. This PR keeps the
 * in-memory MCP store so it can land on main without a competing Drizzle
 * genesis. History still renders; previews stay empty until that chain merges.
 */
export async function attachOutputsToTickets(
  _principalId: string,
  items: SignedTicketRequestRow[]
): Promise<SignedTicketRequestRow[]> {
  return items;
}
