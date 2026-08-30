# Browser Run adapter diagnosis

Date: 2026-08-29
State: RootCaused

## ReproductionReceipt

- SHA: `871637b2841dd85ab1c87fed790732d30cb82918`
- Environment: deployed Cloudflare production API at `https://api.webmcpifier.com/rpc`.
- Public seam: authorized Effect RPC `inspectSite` request for `https://demo.webmcpifier.com/` after the live DNS gate passed.
- Observation: the RPC returned `ScanFailed: The rendered page could not be inspected safely.`
- Canonical issue: unavailable because `birbprophet/webmcpifier` does not yet exist on GitHub and the authenticated GitHub session is blocked. This repository receipt is the current authority.

## RootCauseReceipt

- Alchemy's `BrowserClient.snapshot` and `quickAction("snapshot", ...)` return an Effect containing an already parsed `BrowserRunSnapshotSuccessResponse`; non-success HTTP responses and JSON parsing are already represented as `BrowserError`.
- WebMCPifier's adapter instead declared `quickAction` as `Promise<Response>`, wrapped it in `Effect.tryPromise`, and then read `.ok` and `.json()`.
- The runtime Browser client passed the structural method check, but its returned Effect was treated as a Response. `response.ok` was therefore absent and the scanner deterministically emitted `ScanFailed` before inspecting the Browser Run payload.
- Disconfirming evidence: the Worker binding exists, the compatibility date is newer than Browser Run's required date, the request options conform to current Cloudflare types, and the failure occurs only after live DNS passes.
- Correction: model the dependency as `Pick<BrowserClient, "snapshot">`, execute its Effect directly, map `BrowserError` to the public tagged failure, and Schema-decode the parsed snapshot payload exactly once.
- Affected scope: deployed Browser Run scanning. URL policy, semantic extraction, publication, runtime, and proof logic are unaffected.
- Confidence: high, based on the exact Alchemy binding implementation and the live control flow.
