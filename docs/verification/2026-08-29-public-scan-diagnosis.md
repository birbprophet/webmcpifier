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
- The failing adapter made HTTP subrequests from a Cloudflare Worker back to Cloudflare's public DNS-over-HTTPS endpoint and collapsed every fetch, response, decode, or answer failure into the same `InvalidTarget` result.
- The hostname's independently observed records are public, so the adapter rejected a valid target at its Cloudflare-only DNS subrequest seam rather than at IP classification.
- Cloudflare documents `node:dns` name resolution as a native `nodejs_compat` Worker capability backed by DNS over HTTPS. The API Worker already deploys with that compatibility flag.
- Correction: replace the extra HTTP DNS client and response protocol with one native `resolveAny` call, Schema-decode its records, and retain the existing public-address classification.
- Affected scope: deployed scanning only. Pure URL and IP classification, fixture extraction, publication, runtime, proof storage, studio, and demo are unaffected.
- Confidence: high for the causal seam; the collapsed production error intentionally does not reveal which internal HTTP-DNS sub-step failed.
