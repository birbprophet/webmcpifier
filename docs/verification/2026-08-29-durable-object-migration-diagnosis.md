# Durable Object migration diagnosis

Date: 2026-08-29
State: RootCaused

## ReproductionReceipt

- SHA: `1cae0034c58ff8af59f4d1bd22816b3a6e3abf6c`
- Environment: Alchemy `2.0.0-beta.74`, Effect `4.0.0-rc.112`, Cloudflare production stage, Worker `webmcpifier-api-prod-qmfgpvvskc4b2fpi`.
- Public seam: Cloudflare Workers Versions upload performed by `alchemy deploy`; no Wrangler or dashboard mutation was used.
- Command: `alchemy deploy --stage prod --yes --env-file /private/tmp/webmcpifier-dry-run.env`.
- Observation: Cloudflare rejected the API version with `DurableObjectClassNotFound` because the migration attempted to delete class `CapabilityProof` while the uploaded Worker still referenced it.
- Canonical issue: unavailable because `birbprophet/webmcpifier` does not yet exist on GitHub and the authenticated GitHub session is blocked. This repository receipt is the current authority.

## RootCauseReceipt

- Previous deployed mapping: logical ID `PROOF` to class `CapabilityProof`.
- Candidate mapping: logical ID `CapabilityProof` to class `CapabilityProof`.
- Alchemy correctly interpreted the missing `PROOF` logical ID as a class deletion and the new `CapabilityProof` logical ID as a new class. Cloudflare cannot delete and recreate the same referenced class in one Worker version.
- Causal seam: the string passed to Alchemy's Effect-native `DurableObject` helper is both the binding/logical ID and generated class export. Changing it from the stable deployed binding name `PROOF` changed resource identity even though the TypeScript class name stayed the same.
- Disconfirming evidence: Worker bundling succeeded, the generated module exported the Effect-native class, the full local gate passed, and the production dry-run listed both `[Api/CapabilityProof] create` and `[Api/PROOF] delete`. The failure is therefore migration identity, not bundling, Schema decoding, Durable Object behavior, or Cloudflare credentials.
- Correction: retain the deployed logical ID `PROOF` in the Effect-native helper. Alchemy can then treat the class-name difference as a data-preserving rename under one stable logical resource.
- Affected scope: production API deployment only. Studio deployment succeeded; demo was unchanged.
- Confidence: high, based on Alchemy's logged old/current logical-ID maps and its Worker migration implementation.
