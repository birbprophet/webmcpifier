# Browser runtime and receipt diagnosis

Date: 2026-08-29

This receipt records three defects found only after exercising the deployed public surfaces in the Codex in-app browser.

## Cross-origin runtime did not execute

**Reproduction:** the demo contained the approved SRI-bearing external script, but exposed no WebMCP tool and injected no origin-trial meta element.

**Root cause:** Subresource Integrity requires a cross-origin script response to pass CORS. The Studio's static runtime response did not include `Access-Control-Allow-Origin`, so the browser rejected the script before execution.

**Repair:** `apps/studio/public/_headers` grants `Access-Control-Allow-Origin: *` only to `/runtime/v1.js`. A hosting regression test locks the header. The deployed runtime response and local built bytes were compared byte-for-byte before browser retest.

## Browser omitted WebMCP execution options

**Reproduction:** the installed tool registered, but its first call failed before form mutation while reading `options.signal`. The Studio's receipt tool failed through the same browser bridge.

**Root cause:** the current browser bridge called imperative WebMCP callbacks without the draft API's second execution-options object.

**Repair:** both the installed runtime and Studio tools prefer the per-execution signal when supplied and otherwise use their registration `AbortSignal`. Abort ownership and cleanup remain state-scoped. Regression tests call tools without execution options and then prove the registration signal still cancels them.

## Receipt UI could not reach Effect RPC

**Reproduction:** direct NDJSON requests returned the correct proof aggregate, while the public receipt UI showed “not available.”

**Root causes:**

1. Effect's HTTP client propagates `b3` and `traceparent`, but the API preflight originally allowed only `content-type`.
2. `RpcClient.layerProtocolHttp({ url: "…/rpc" })` sends to `/rpc/`, while the Worker's explicit route set originally allowed only `/rpc`.

**Repair:** RPC preflight now permits exactly `b3, content-type, traceparent` for the canonical Studio origin, while telemetry remains limited to `content-type`. The Worker explicitly accepts both `/rpc` and Effect's generated `/rpc/`; tests lock both paths. After deployment, the private UI and its own `get_proof_summary` WebMCP tool both returned one invocation, one success, zero failures/aborts, and the ≤100 ms latency bucket.

## Final public identity

- Release: `aa0a40017c30acfe51a6e98c39ca0b30ec4640e5`
- Capability: `cap_c04b73f132964dc6b89dd18b525f36f7`
- Contract hash: `0f4f6e2bc11bac980c2c5b7813bb052d3e241f1e08af63dd67b19e3a6e600f6e`
- Runtime: `1.0.0`
- Authorized origin: `https://demo.webmcpifier.com`

No receipt read token, form value, query string, cookie, or claimed agent identity is included in this record.
