# WebMCPifier implementation receipt

Date: 2026-08-29

This receipt separates design intent from executed evidence. A checked item needs a concrete command, route, or browser artifact; source presence alone is not proof.

## 2026-08-30 approved installed release update

The current installed application release is `43b03fe66ab39e06d0939ed5dbcf1722851f122d`. It is pushed to `origin/main`, Alchemy reported that exact SHA, and the API returns it in `x-webmcpifier-release`.

- The release owner crossed the visible human-only approval gate. `get_install_skill` then returned the production tag, exact closed schema, verification prompt, and a private fragment-bearing receipt URL.
- The generated tag was added as the single authorized demo-source edit. Its config payload, runtime URL, SRI, CORS mode, and defer flag match the approved artifact.
- `vp run ready` passed 91 formatting checks, lint and type checking across 57 source files, 17 test files with 65 tests, and every workspace build.
- Alchemy completed eight production updates/no-ops. The Studio and demo return 200, the API is reachable and reports the exact release, and the apex returns 301 to the canonical `www` origin.
- The deployed runtime returns `Access-Control-Allow-Origin: *`, and the live bytes hash to `sha384-1r4UkjuZeCOzB0Eo4rXiXvoCW2Og+CH2p3WOQRjWLFyLBzSfqPM7QXfuFpFHZ79f`, matching the installed SRI.
- The public demo exposed exactly `prepare_service_quote` with the approved seven-field closed schema. Its fictional call returned `ready_for_review`, `submissionRequired: true`, and `updatedFieldCount: 7` without echoing the name, email, or job details.
- After execution, the URL was unchanged, focus was on `review-request`, the review dialog remained closed, and `data-human-submitted` was absent. The visible form contained the fictional values; the browser inspection API intentionally redacted direct email readback.
- The private receipt UI and `get_proof_summary` agreed: capability `cap_28f7b748d38745f5a49b3f136fc61865`, hash `4371d2f8f6a1bb186889daae4587152f601eb6a5f49049b46abd9704eeb5c262`, one invocation, one success, zero failures, zero aborts, latency at most 100 ms, runtime `1.0.0`, and exact demo origin.

No receipt read token, write token, contact value, argument, output, cookie, or query string is recorded in this document.

## Historical 2026-08-30 pre-install release update

The current public pre-install release is `fde32ec68a4e001a4de43820d64623264d005d6a`. The API reports that exact SHA in `x-webmcpifier-release`, and `origin/main` contains the same application source.

- `vp run ready` passed formatting, lint, type checking, 65 tests, and every workspace build.
- The public demo has one stable seven-control form, no `data-webmcpifier` runtime tag, and no WebMCP tools.
- The public Studio was browser-verified at 1440, 805, and 390 CSS pixels with no horizontal overflow. Header, progress, workspace, and safety edges share one gutter; the desktop hero columns share one top edge.
- The live WebMCP flow inspected the demo, drafted the exact `prepare_service_quote` contract, validated it, and stopped at the untouched human approval boundary. The target appears before the contract and approval action, including on mobile, and no install artifact exists.
- The Studio's registered first-party origin-trial token is active in the in-app browser. The registered third-party token is configured for generated capabilities but cannot be exercised on the intentionally uninstalled demo until approval.

At that point, the release owner's approval click, newly generated tag, installed-tool call, fresh proof receipt, and narrated capture were still pending. The approved installed update above supersedes those technical blockers; narrated capture remains pending.

| Contract                                              | Specified | Locally tested | Built | Deployed | Browser verified                                                                   |
| ----------------------------------------------------- | --------- | -------------- | ----- | -------- | ---------------------------------------------------------------------------------- |
| Public HTTPS target policy                            | Yes       | Yes            | Yes   | Yes      | Live public demo accepted through Browser Run                                      |
| Semantic form inventory and fingerprint               | Yes       | Yes            | Yes   | Yes      | Seven controls and the stable `quote-form` inventory returned through WebMCP       |
| Human-only approval gate                              | Yes       | Yes            | Yes   | Yes      | Public Studio stopped at approval; no artifact existed and only revision remained  |
| State-scoped WebMCP authoring tools                   | Yes       | Yes            | Yes   | Yes      | `inspect_site` → draft/validate → revision-only tool replacement observed          |
| Config-bearing runtime tag                            | Yes       | Yes            | Yes   | Yes      | Final SRI runtime registered `prepare_service_quote` on the public demo            |
| Fill-for-review runtime with zero submit side effects | Yes       | Yes            | Yes   | Yes      | Seven updates, review focus, valid review gate, unchanged URL, no submission       |
| Aggregate proof receipt                               | Yes       | Yes            | Yes   | Yes      | Private UI and `get_proof_summary` both rendered the same `1/1` aggregate          |
| Full authoring-to-installed public journey            | Yes       | Yes            | Yes   | Yes      | One continuous browser state crossed human approval, installed, called, and proved |
| Origin-trial release-input validation                 | Yes       | Yes            | Yes   | No       | Placeholder, malformed, expired, and incorrectly scoped tokens block deployment    |
| Exact authoring inputs and shared form-contract match | Yes       | Yes            | Yes   | Yes      | Live authoring schema and installed runtime schema matched the approved contract   |

## Evidence ledger

| Evidence                        | Result  | Artifact                                                                                                                                                        |
| ------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vp run ready`                  | Passed  | 91 files formatted; 57 source files linted/type-checked; 17 test files and 65 tests passed; all workspaces built                                                |
| Property verification           | Passed  | Native `@effect/vitest` properties cover generated public URLs, tagged private-target failures, text budgets, inventories, fingerprints, and config round trips |
| Vite+/Vitest caching            | Passed  | Installed-release gate reported 5/11 Vite+ task cache hits, replayed cached Vitest suites, and saved 1.88 seconds                                               |
| Alchemy production deployment   | Passed  | `Alchemy.run` deployed API, demo, Studio, Browser Run binding, Durable Object, custom domains, and redirect                                                     |
| Exact public release            | Passed  | API header reports `43b03fe66ab39e06d0939ed5dbcf1722851f122d`                                                                                                   |
| Public route policy             | Passed  | `www` 200, demo 200, API reachable, apex 301 to canonical `www`                                                                                                 |
| Runtime SRI and CORS            | Passed  | Live runtime bytes equal the built asset; `Access-Control-Allow-Origin: *`; SRI is `sha384-1r4UkjuZeCOzB0Eo4rXiXvoCW2Og+CH2p3WOQRjWLFyLBzSfqPM7QXfuFpFHZ79f`    |
| Browser Run inspection          | Passed  | Public `inspect_site` returned Northstar, `/`, `quote-form`, and seven semantic controls                                                                        |
| Public authoring lifecycle      | Passed  | Browser called inspect, draft, and validate; Studio visibly reached approval and replaced tools with revision-only scope                                        |
| Public installed tool           | Passed  | `prepare_service_quote` discovered with a closed seven-field schema at `https://demo.webmcpifier.com/`                                                          |
| Public fill-for-review call     | Passed  | Result was `ready_for_review`, `submissionRequired: true`, `updatedFieldCount: 7`; review focus, unchanged URL, no submission                                   |
| Aggregate proof                 | Passed  | Capability `cap_28f7b748d38745f5a49b3f136fc61865`: one invocation, one success, zero failures/aborts, ≤100 ms                                                   |
| Contract identity               | Passed  | Hash `4371d2f8f6a1bb186889daae4587152f601eb6a5f49049b46abd9704eeb5c262`, runtime `1.0.0`, exact demo origin                                                     |
| Public GitHub repository        | Passed  | `birbprophet/webmcpifier` is public, defaults to `main`, and GitHub reports the MIT license                                                                     |
| Real Chrome origin-trial tokens | Partial | Registered values are deployed; generic Chrome origin-trial verification remains pending                                                                        |

The email value is intentionally redacted by the in-app browser's direct DOM readback surface but remained visibly rendered in the fictional-data screenshot. The runtime returned seven updates, focused the human review control, left the dialog closed, and did not add `data-human-submitted`.

This public run crossed the human-only approval button in the same authoring state, installed the returned artifact, and proved the resulting capability and receipt. A narrated video and the final Devpost/YouTube actions remain human-only submission work.
