# WebMCPifier

Describe one website task to the browser agent you already use. Review its contract. Add one generated tag. Prove the new tool works.

WebMCPifier is a WebMCP-native compiler for nontechnical website owners. Its authoring studio exposes WebMCP tools that a browser agent calls to inspect a different public page, draft one bounded form capability, pause for human approval, produce one auditable installation edit, and show aggregate proof after the installed tool runs.

V1 supports one well-labelled semantic form on one public page. It fills that form for human review and can never submit it.

## Live surfaces

- Studio: [www.webmcpifier.com](https://www.webmcpifier.com)
- Customer demo: [demo.webmcpifier.com](https://demo.webmcpifier.com)
- Effect RPC and proof API: [api.webmcpifier.com](https://api.webmcpifier.com)
- Source: [github.com/birbprophet/webmcpifier](https://github.com/birbprophet/webmcpifier)

The apex [webmcpifier.com](https://webmcpifier.com) permanently redirects to the canonical `www` origin. The deployed application release is `aa0a40017c30acfe51a6e98c39ca0b30ec4640e5`. See the dated [implementation receipt](docs/verification/2026-08-29-implementation-receipt.md) for the verification state; a URL in this list is not, by itself, evidence that a journey passed.

The public demo is intentionally frozen in its installed state so judges can discover and call the final tool. The pre-install state, where the same page exposes no tools, is captured separately for the narrated submission flow.

## Public smoke test

Use ChatGPT's in-app browser or Chrome 149+ with `chrome://flags/#enable-webmcp-testing` enabled.

1. Open the customer demo and ask: `What WebMCP tools does this page expose?` Confirm `prepare_service_quote` has a closed seven-field schema.
2. Ask:

   > Prepare a plumbing service quote for Alex Chen at alex@example.test. It is urgent, for a house, postcode TEST 1AA, and the details are: Demonstration leak under the kitchen sink. Do not submit it.

3. Confirm the page URL did not change, all seven fields pass native validity, focus is on **Review request**, and no submission confirmation exists. Opening and closing **Review request** is safe; do not press **Send request**.
4. Open the Studio in a clean tab and ask:

   > Inspect https://demo.webmcpifier.com and draft a tool named prepare_service_quote that fills the service quote for review and never submits it.

5. Confirm the agent calls `inspect_site`, `draft_form_tool`, and `validate_draft`; the Studio must stop on the visible approval contract. Only `revise_form_tool` remains exposed at that point, and no installation artifact exists.

## Narrated build flow

The submission capture starts from the same demo without its generated tag, then records this complete transition:

1. Show that the customer page exposes no WebMCP tools.
2. Run the authoring prompt above and show the Studio's rendered inspection, semantic inventory, contract, and safety boundary.
3. Press **Approve capability** yourself. The browser agent cannot cross this gate.
4. Ask: `Give me the installation skill for the approved capability.`
5. Add only the returned tag to the demo HTML shell and deploy through the repository's existing Alchemy command.
6. Reopen the same public demo and ask:

   > Prepare a plumbing service quote for Alex Chen at alex@example.test. It is urgent, for a house, postcode TEST 1AA, and the details are: Demonstration leak under the kitchen sink. Do not submit it.

7. Confirm the page is still on the form, every value is visible, focus is on **Review request**, and no submission confirmation exists.
8. Open the private receipt returned by WebMCPifier and confirm one successful invocation and its latency bucket.

## Why this is WebMCP-native

The scanner and script tag are supporting mechanisms. The product's differentiator is recursive authoring: the browser agent uses WebMCP to create a reviewed WebMCP capability for another site. The visible studio mirrors those tool calls rather than embedding another chat or model.

The current authoring surface is state-scoped:

- `inspect_site`
- `draft_form_tool`
- `revise_form_tool`
- `validate_draft`
- `get_install_skill`
- `get_proof_summary`

Only tools relevant to the current studio state are registered. Each state owns an `AbortController`; leaving it aborts those registrations before the next disjoint set is registered. Inventory output is marked as untrusted third-party content, while names and descriptions remain controlled by WebMCPifier.

## Safety contract

The installed runtime:

- requires the exact approved origin and pathname;
- recomputes the semantic form fingerprint before registration and execution;
- validates the closed input object and native HTML constraints again in the page;
- sets native form values and dispatches `input` and `change` events;
- never clicks, submits, calls `requestSubmit`, or invokes the form action;
- focuses the existing **Review request** control;
- returns a controlled summary without echoing contact data;
- feature-detects `document.modelContext` and otherwise does nothing;
- unregisters through its registration `AbortSignal`; and
- sends only capability metadata, outcome, latency, runtime version, and origin as proof.

WebMCPifier never stores arguments, outputs, form values, query strings, cookies, contact data, or claimed agent identity. A per-capability Durable Object stores aggregate counters, latency buckets, last-seen time, the runtime version, contract hash, and authorized origin. The write token and separate receipt token are stored only as hashes. The object deletes itself after 30 days of inactivity.

The scanner accepts public HTTPS URLs only. It rejects credentials, localhost, IP literals, local host suffixes, unsupported or oversized pages, excessive redirects, and forms without stable semantic identifiers. It does not generate selectors, coordinates, click macros, or JavaScript.

## Architecture

```text
browser agent
    │ WebMCP authoring tools
    ▼
FoldKit studio ── Effect RPC/NDJSON ── API Worker
    │                                  ├─ Browser Run: rendered inspection
    │ human approval                   └─ Durable Object: aggregate proof
    ▼
config-bearing external script tag
    │
    ▼
semantic customer form ── metadata-only proof event ── API Worker
```

- `apps/studio` — hydrated FoldKit authoring and private receipt UI.
- `apps/demo` — independent semantic Northstar Home Services Vite site.
- `apps/api` — Effect RPC Worker, Browser Run scanner, publication, and proof telemetry.
- `packages/domain` — Effect Schema contracts, tagged errors, compiler, and one shared RPC group.
- `packages/runtime` — directly loaded, versioned browser runtime with a closed dependency-free validator.
- `alchemy.run.ts` — the only deployment graph for Browser Run, rate limiting, Durable Objects, Worker, websites, custom domains, and redirect.

The dependency-free installed runtime is the deliberate exception to using Effect at application boundaries: it must remain a small external script and independently distrust its embedded config. Every server, RPC, environment, persistence, and UI boundary uses Effect Schema; all tests import from `@effect/vitest`.

## Development

Requirements are Bun 1.4.0 and the repository-pinned Vite+ 0.3.0 toolchain.

```bash
vp install
vp run ready
```

`vp run ready` formats, lints, type-checks, runs every `@effect/vitest` suite, and builds each workspace. Vite+ task caching and Vitest's filesystem module cache are enabled. Raw `vitest`, `vite-plus/test`, and `bun:test` imports are lint errors.

Run the FoldKit studio alone:

```bash
vp run studio#dev
```

Run the Cloudflare topology locally through Alchemy:

```bash
vp run dev:stack
```

## Deployment

There is no Wrangler configuration and no manual Cloudflare deployment path.

```bash
vp run deploy --stage <stage> --env-file <private-env-file>
```

Copy `.env.example` to a private ignored file and fill it before deploying. Alchemy requires every deployment input; no value has a default or optional alias:

- `WEBMCPIFIER_API_ORIGIN`
- `WEBMCPIFIER_DEMO_ORIGIN`
- `WEBMCPIFIER_RELEASE_COMMIT`
- `WEBMCPIFIER_RUNTIME_INTEGRITY`
- `WEBMCPIFIER_STUDIO_ORIGIN`
- `WEBMCP_FIRST_PARTY_ORIGIN_TRIAL_TOKEN`
- `WEBMCP_THIRD_PARTY_ORIGIN_TRIAL_TOKEN`

The same private file must provide Alchemy's `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`. The repository exposes names and scopes only; never commit their values.

Any stage other than `prod` stays on `workers.dev`. Stage `prod` binds the three production hostnames and the apex redirect. The public first-party and third-party origin-trial tokens must match their registered origins; they are browser activation tokens, not private API credentials.

The deployed release has been browser-verified with the Codex in-app browser's WebMCP support. Real Chrome first-party and third-party origin-trial tokens remain a release-owner input; until those registered tokens replace the current test values, use Chrome's WebMCP testing flag for generic Chrome verification.

## Scope

WebMCPifier does not include accounts, a project dashboard, whole-site crawling, arbitrary DOM workflows, source-repository ingestion, automatic submission, payments, authenticated-page scanning, A/B testing, agent attribution, a hosted LLM, or an embedded chat.

The dated [competitive landscape](docs/research/2026-08-29-competitive-landscape.md) records the overlap with Keak, Conscriba, Latch, webmcp.com, and webmcpify without claiming those products lack unannounced capabilities. The [implementation foundations](docs/research/2026-08-29-implementation-foundations.md) pin the primary technical sources and rejected mechanisms.

## License

[MIT](LICENSE) © 2026 Benjamin Tang.
