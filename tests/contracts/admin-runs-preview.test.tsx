// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import AdminWorkspace from "@/components/admin/AdminWorkspace";
import CallsTable from "@/components/console/CallsTable";
import type { AccountActivityRow } from "@/lib/console/types";

const originalScrollIntoView = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "scrollIntoView"
);
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (originalScrollIntoView)
    Object.defineProperty(
      HTMLElement.prototype,
      "scrollIntoView",
      originalScrollIntoView
    );
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});

it("preserves personal History navigation when no admin inspector is provided", () => {
  const row: AccountActivityRow = {
    id: "personal-request",
    environmentId: "sample",
    timestamp: new Date().toISOString(),
    model: "Sample model",
    pipeline: "text-to-image",
    costDisplay: "$0.01",
    status: "success",
    kind: "batch",
    latencyMs: null,
    durationMs: null,
    signer: "paymthouse",
    signerLabel: "Console",
    tokenId: "sample",
    tokenName: "Sample",
  };
  render(
    <CallsTable
      rows={[row]}
      bordered={false}
      density="cozy"
      variant="requests"
    />
  );
  expect(screen.getByRole("link").getAttribute("href")).toBe(
    "/home?request=personal-request"
  );
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.getByText("t2i")).toBeTruthy();
});

it("switches between waitlist and platform history without networking", () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  render(
    <AdminWorkspace>
      <div>Existing waitlist</div>
    </AdminWorkspace>
  );
  expect(
    screen.getByRole("tab", { name: "Waitlist" }).getAttribute("aria-selected")
  ).toBe("true");
  expect(screen.queryByRole("region", { name: "Platform history" })).toBeNull();
  fireEvent.click(screen.getByRole("tab", { name: "History" }));
  expect(screen.getByRole("tabpanel", { name: "History" })).toBeTruthy();
  expect(
    screen.getByRole("heading", { name: "Platform History" })
  ).toBeTruthy();
  expect(screen.queryByText("Sample data · Not connected")).toBeNull();
  const table = screen.getByRole("region", { name: "Platform history" });
  expect(
    within(table).getAllByRole("button", { name: /Inspect demo-run/ })
  ).toHaveLength(8);
  expect(screen.queryByRole("combobox")).toBeNull();
  fireEvent.change(screen.getByRole("textbox", { name: "Search runs" }), {
    target: { value: " ALEX@example.com " },
  });
  expect(
    within(table).getAllByRole("button", { name: /Inspect demo-run/ })
  ).toHaveLength(2);
  expect(within(table).queryByText("jamie@example.com")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Inspect demo-run-008" }));
  const inspector = screen.getByRole("dialog", {
    name: "FLUX.1 Schnell detail",
  });
  expect(within(inspector).getByText("Capability")).toBeTruthy();
  expect(within(inspector).getByText("Modality")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Open history entry 2" }));
  expect(
    screen.getByRole("dialog", { name: "Llama 3.3 70B detail" })
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Return to dashboard" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.change(screen.getByRole("textbox", { name: "Search runs" }), {
    target: { value: "caption" },
  });
  expect(
    within(table).getAllByRole("button", { name: /Inspect demo-run/ })
  ).toHaveLength(1);
  fireEvent.change(screen.getByRole("textbox", { name: "Search runs" }), {
    target: { value: "no-such-sample" },
  });
  expect(screen.getByText("No sample runs match these filters.")).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled();
});

it("shows summary counts and combines status, user, and visible model filters", () => {
  render(
    <AdminWorkspace>
      <div>Waitlist content</div>
    </AdminWorkspace>
  );
  fireEvent.click(screen.getByRole("tab", { name: "History" }));
  expect(screen.getByText("Total runs").parentElement?.textContent).toBe(
    "Total runs8"
  );
  const filters = screen.getByRole("group", { name: "Filter runs by status" });
  fireEvent.click(within(filters).getByRole("button", { name: "In progress" }));
  expect(screen.getByRole("status").textContent).toBe("2 sample runs");
  fireEvent.change(screen.getByRole("textbox", { name: "Search runs" }), {
    target: { value: "FLUX" },
  });
  expect(screen.getByRole("status").textContent).toBe("1 sample runs");
  fireEvent.click(within(filters).getByRole("button", { name: "Failed" }));
  expect(screen.getByText("No sample runs match these filters.")).toBeTruthy();
});

it("supports keyboard tab switching", () => {
  render(
    <AdminWorkspace>
      <div>Existing waitlist</div>
    </AdminWorkspace>
  );
  fireEvent.keyDown(screen.getByRole("tab", { name: "Waitlist" }), {
    key: "ArrowRight",
  });
  expect(document.activeElement).toBe(
    screen.getByRole("tab", { name: "History" })
  );
  fireEvent.keyDown(screen.getByRole("tab", { name: "History" }), {
    key: "Home",
  });
  expect(
    screen.getByRole("tab", { name: "Waitlist" }).getAttribute("aria-selected")
  ).toBe("true");
});
