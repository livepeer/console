import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/mcp/store", () => ({
  listAssetsForGatewayRequestIds: vi.fn().mockResolvedValue([]),
}));
import { attachOutputsToTickets } from "@/lib/console/activity-assets";
import type { SignedTicketRequestRow } from "@/lib/console/account-usage";
it("removes an upstream outputUrl without a matching owned asset", async () => {
  const result = await attachOutputsToTickets("eu_test", [
    {
      gatewayRequestId: "job",
      outputUrl: "https://provider.example/a",
    } as SignedTicketRequestRow,
  ]);
  expect(result[0]?.outputUrl).toBeNull();
});
