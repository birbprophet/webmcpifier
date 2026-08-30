# Public scan diagnosis

Date: 2026-08-29
State: RootCaused

## ReproductionReceipt

- SHA: `2f7a9d352240e475cd26c7d0999be899728c01f8`
- Environment: deployed Cloudflare production API at `https://api.webmcpifier.com/rpc`.
- Public seam: an Effect NDJSON RPC `inspectSite` request from the authorized studio origin for `https://demo.webmcpifier.com/`.
- Observation: the RPC returned `InvalidTarget: The target hostname does not resolve to a public address.` before Browser Run executed.
- Counter-evidence: public A records `104.21.2.26` and `172.67.128.157`, plus globally routed IPv6 records, resolve from both the system resolver and Cloudflare's public resolver.
- Canonical issue: unavailable because `birbprophet/webmcpifier` does not yet exist on GitHub and the authenticated GitHub session is blocked. This repository receipt is the current authority.

## RootCauseReceipt

- The URL parser accepted the target and the live RPC transport succeeded.
- The first failing adapter made HTTP subrequests from a Cloudflare Worker back to Cloudflare's public DNS-over-HTTPS endpoint and collapsed every fetch, response, decode, or answer failure into the same `InvalidTarget` result.
- Replacing that adapter with Cloudflare's documented `node:dns` `resolveAny` capability did not change the public result. A controlled deploy with distinct resolver, decode, and address errors then identified the resolver call itself as the failing stage.
- `resolveAny` performs an `ANY` query. Node's DNS API documentation explicitly warns that DNS operators may decline `ANY` queries and recommends calling individual methods such as `resolve4` instead. Source: [Node DNS `resolveAny`](https://nodejs.org/api/dns.html#dnsresolveanyhostname-callback).
- The hostname's independently observed A and AAAA records are public, so URL parsing, output decoding, and IP classification are disconfirmed causes.
- Correction: resolve A and AAAA independently through the documented Worker `node:dns` compatibility API, accept only the standard `NODATA` error as an absent address family, Schema-decode both address arrays, and fail closed on every other resolver error.
- Affected scope: deployed scanning only. Pure URL and IP classification, fixture extraction, publication, runtime, proof storage, studio, and demo are unaffected.
- Confidence: high, based on two public controlled replays, stage-specific errors, public record checks, and the resolver contract.
