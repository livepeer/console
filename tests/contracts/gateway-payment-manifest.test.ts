import { createServer } from "node:http";
import { once } from "node:events";
import { createRequire } from "node:module";
import { expect, it } from "vitest";
import * as esm from "@pymthouse/gateway-web";
const cjs = createRequire(import.meta.url)(
  "@pymthouse/gateway-web"
) as typeof esm;

async function fixture(mode: "single-shot" | "persistent", failFirst = false) {
  const order: string[] = [];
  let payments = 0;
  let origin = "";
  const server = createServer(async (req, res) => {
    const parts: Buffer[] = [];
    for await (const part of req) parts.push(Buffer.from(part));
    const body = parts.length
      ? JSON.parse(Buffer.concat(parts).toString())
      : {};
    const path = new URL(req.url!, origin).pathname.replace("/app/", "/");
    const json = (status: number, value: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(value));
    };
    if (path === "/discover-orchestrators")
      return json(
        200,
        (failFirst ? ["first", "second"] : ["first"]).map((id) => ({
          address: origin + "/orch-" + id,
          runners: [
            {
              app: "test-app",
              url: origin + "/" + id + "/",
              mode,
              runner_id: id,
              price_info: { price: 1, currency: "wei", unit: "fixed" },
            },
          ],
        }))
      );
    if (path === "/sign-orchestrator-info")
      return json(200, { address: "0xabc", signature: "0xsig" });
    if (path === "/generate-live-payment") {
      payments++;
      order.push("paid:" + body.ManifestID);
      return json(200, { payment: "PAY", segCreds: "SEG", state: {} });
    }
    if (path === "/first/" || path === "/second/") {
      const id = path.slice(1, -1);
      if (!req.headers["livepeer-payment"])
        return json(402, {
          payment_params: "p",
          manifest_id: "manifest-" + id,
          payment_url: origin + "/pay",
        });
      order.push("provider:" + id);
      if (failFirst && id === "first")
        return json(503, { error: "provider_failed" });
      return json(
        200,
        mode === "persistent"
          ? {
              session_id: "provider-session",
              app_url: origin + "/session-app",
              control_url: origin + "/control",
            }
          : { text: "ok", request_id: "provider" }
      );
    }
    if (path === "/session-app/hello") return json(200, { text: "ok" });
    if (path === "/control/stop") return json(200, {});
    json(404, {});
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  return {
    order,
    payments: () => payments,
    origin,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
for (const [name, sdk] of [
  ["ESM", esm],
  ["CJS", cjs],
] as const) {
  it.each(["single-shot", "persistent"] as const)(
    `${name} records the payment manifest before charging and before provider completion (%s)`,
    async (mode) => {
      const f = await fixture(mode);
      try {
        await sdk
          .createGateway({ signerUrl: f.origin, timeoutMs: 5000 })
          .runInference({
            capability: "test-app",
            ...(mode === "persistent" ? { endpoint: "/hello" } : {}),
            onPayment: async ({ manifestId, phase }) => {
              f.order.push(phase + ":" + manifestId);
            },
          });
        expect(f.order).toEqual([
          "prepared:manifest-first",
          "paid:manifest-first",
          "accepted:manifest-first",
          "provider:first",
        ]);
      } finally {
        await f.close();
      }
    }
  );
  it(`${name} preserves manifests from paid failed attempts and failover`, async () => {
    const f = await fixture("single-shot", true);
    try {
      await sdk
        .createGateway({ signerUrl: f.origin, timeoutMs: 5000 })
        .runInference({
          capability: "test-app",
          onPayment: async ({ manifestId, phase }) => {
            f.order.push(phase + ":" + manifestId);
          },
        });
      expect(f.order.filter((s) => s.startsWith("accepted:"))).toEqual([
        "accepted:manifest-first",
        "accepted:manifest-second",
      ]);
      expect(f.payments()).toBe(2);
    } finally {
      await f.close();
    }
  });
  it.each(["prepared", "accepted"])(
    `${name} stops without paid failover if persistence fails at %s`,
    async (phase) => {
      const f = await fixture("single-shot", true);
      try {
        await expect(
          sdk
            .createGateway({ signerUrl: f.origin, timeoutMs: 5000 })
            .runInference({
              capability: "test-app",
              onPayment: async (p) => {
                if (p.phase === phase) throw new Error("db unavailable");
              },
            })
        ).rejects.toThrow("payment_manifest_persistence_failed");
        expect(f.payments()).toBe(phase === "prepared" ? 0 : 1);
        expect(f.order.some((s) => s.startsWith("provider:"))).toBe(false);
      } finally {
        await f.close();
      }
    }
  );
}
