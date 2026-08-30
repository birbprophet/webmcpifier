# Public scan diagnosis

Date: 2026-08-29
State: Reproduced

## ReproductionReceipt

- SHA: `2f7a9d352240e475cd26c7d0999be899728c01f8`
- Environment: deployed Cloudflare production API at `https://api.webmcpifier.com/rpc`.
- Public seam: an Effect NDJSON RPC `inspectSite` request from the authorized studio origin for `https://demo.webmcpifier.com/`.
- Observation: the RPC returned `InvalidTarget: The target hostname does not resolve to a public address.` before Browser Run executed.
- Counter-evidence: public A records `104.21.2.26` and `172.67.128.157`, plus globally routed IPv6 records, resolve from both the system resolver and Cloudflare's public resolver.
- Canonical issue: unavailable because `birbprophet/webmcpifier` does not yet exist on GitHub and the authenticated GitHub session is blocked. This repository receipt is the current authority.

## Investigation update

- The URL parser accepted the target and the live RPC transport succeeded.
- The first failing adapter made HTTP subrequests from a Cloudflare Worker back to Cloudflare's public DNS-over-HTTPS endpoint and collapsed every fetch, response, decode, or answer failure into the same `InvalidTarget` result.
- Replacing that adapter with Cloudflare's documented `node:dns` `resolveAny` capability did not change the public result. That disconfirms the HTTP subrequest itself as a sufficient root cause.
- The hostname's independently observed records are public, so URL parsing and IP classification remain unlikely causes. The unresolved seam is now the production resolver call versus its Schema-decoded result.
- Next controlled variable: preserve the generic public safety boundary while assigning distinct deterministic errors to resolver failure, invalid resolver output, and a resolved non-public address. A live replay can then identify the failing stage without exposing DNS data.
- Affected scope: deployed scanning only. Pure URL and IP classification, fixture extraction, publication, runtime, proof storage, studio, and demo are unaffected.
- Confidence: high that the resolver adapter is the causal seam; root cause inside that seam is not yet established.
