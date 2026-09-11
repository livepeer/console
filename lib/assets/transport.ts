import { request as httpsRequest } from "node:https";
import { Readable } from "node:stream";
import type { LookupAddress } from "node:dns";

/** Connect only to the checked address; URL hostname still controls Host and TLS. */
export function fetchPinnedAsset(
  url: URL,
  addresses: LookupAddress[],
  init: {
    method: string;
    headers: Record<string, string>;
    signal: AbortSignal;
  }
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const address = addresses[0];
    if (!address) return reject(new Error("unsafe_asset_origin"));
    const req = httpsRequest(
      url,
      {
        method: init.method,
        headers: init.headers,
        signal: init.signal,
        agent: false,
        lookup: (_hostname, options, callback) => {
          if (options.all) callback(null, [address]);
          else callback(null, address.address, address.family);
        },
      },
      (incoming) => {
        const headers = new Headers();
        for (const [key, value] of Object.entries(incoming.headers)) {
          if (value !== undefined)
            headers.set(key, Array.isArray(value) ? value.join(", ") : value);
        }
        const status = incoming.statusCode ?? 502;
        const noBody =
          init.method === "HEAD" || [204, 205, 304].includes(status);
        if (noBody) incoming.resume();
        resolve(
          new Response(
            noBody
              ? null
              : (Readable.toWeb(incoming) as ReadableStream<Uint8Array>),
            { status, headers }
          )
        );
      }
    );
    req.on("error", reject);
    req.end();
  });
}
