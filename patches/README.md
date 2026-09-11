# gateway-web payment observation

The patch for pinned @pymthouse/gateway-web 0.3.4 adds an optional awaited
`onPayment({ manifestId, phase })` callback to inference/reserve requests and
lower-level runner options. It is threaded through single-shot, persistent and
failover paths in both ESM and CommonJS distributions.

`prepared` runs before the signer request, so Console can persist lineage before
spending. `accepted` runs after payment and segment credentials are returned.
Callbacks expose no payment credentials or signer state. Callback exceptions
become plain non-retryable errors, preventing database failures from triggering
paid runner failover. A prepared manifest alone is not evidence of a charge;
PymtHouse's aggregate supplies the actual network cost.

This preserves the SDK's discovery, payment, queue, cleanup and retry behavior.
Do not replace it with a process-global observer: concurrent users must remain
isolated. Remove this patch when an upstream release exposes equivalent capture
semantics. Contract tests exercise the installed package, both module formats,
persistent calls, paid failover and callback failures.
