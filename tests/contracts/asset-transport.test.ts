import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { TLSSocket } from "node:tls";
import { expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ ca: "" }));
vi.mock("node:https", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:https")>();
  return {
    ...original,
    request: vi.fn((url, options, callback) =>
      original.request(url, { ...options, ca: harness.ca }, callback)
    ),
  };
});
import { createServer, request } from "node:https";
import { fetchPinnedAsset } from "@/lib/assets/transport";

it("pins the connection while preserving TLS hostname, range, HEAD, and stream cancellation", async () => {
  const dir = mkdtempSync(join(tmpdir(), "asset-transport-"));
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      join(dir, "key.pem"),
      "-out",
      join(dir, "cert.pem"),
      "-days",
      "1",
      "-subj",
      "/CN=media.example.test",
      "-addext",
      "subjectAltName=DNS:media.example.test",
    ],
    { stdio: "ignore" }
  );
  harness.ca = readFileSync(join(dir, "cert.pem"), "utf8");
  let host = "",
    servername = "",
    range = "";
  const server = createServer(
    { key: readFileSync(join(dir, "key.pem")), cert: harness.ca },
    (req, res) => {
      host = req.headers.host!;
      servername = (req.socket as TLSSocket).servername || "";
      range = req.headers.range || "";
      if (req.url === "/slow") {
        res.writeHead(200);
        res.write("start");
        return;
      }
      res.writeHead(req.headers.range ? 206 : 200, {
        "content-type": "video/mp4",
      });
      res.end("bytes");
    }
  );
  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const port = (server.address() as AddressInfo).port;
    const url = new URL(`https://media.example.test:${port}/video`);
    const options = {
      method: "GET",
      headers: { Range: "bytes=0-4" },
      signal: AbortSignal.timeout(5000),
    };
    const response = await fetchPinnedAsset(
      url,
      [{ address: "127.0.0.1", family: 4 }],
      options
    );
    expect(response.status).toBe(206);
    expect(await response.text()).toBe("bytes");
    expect(host).toBe(`media.example.test:${port}`);
    expect(servername).toBe("media.example.test");
    expect(range).toBe("bytes=0-4");
    expect(vi.mocked(request).mock.calls[0]?.[1]).toMatchObject({
      agent: false,
      lookup: expect.any(Function),
    });
    const head = await fetchPinnedAsset(
      url,
      [{ address: "127.0.0.1", family: 4 }],
      { ...options, method: "HEAD" }
    );
    expect(head.body).toBeNull();
    const controller = new AbortController();
    const slow = await fetchPinnedAsset(
      new URL("/slow", url),
      [{ address: "127.0.0.1", family: 4 }],
      { ...options, signal: controller.signal }
    );
    const reader = slow.body!.getReader();
    await reader.read();
    controller.abort();
    await expect(reader.read()).rejects.toThrow();
    await expect(
      fetchPinnedAsset(
        new URL(`https://wrong.example.test:${port}/`),
        [{ address: "127.0.0.1", family: 4 }],
        options
      )
    ).rejects.toThrow();
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(dir, { recursive: true, force: true });
  }
}, 15000);
