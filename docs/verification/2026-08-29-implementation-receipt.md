# WebMCPifier implementation receipt

Date: 2026-08-29

This receipt separates design intent from executed evidence. A checked item needs a concrete command, route, or browser artifact; source presence alone is not proof.

| Contract                                              | Specified | Locally tested | Built | Deployed | Browser verified                                                                   |
| ----------------------------------------------------- | --------- | -------------- | ----- | -------- | ---------------------------------------------------------------------------------- |
| Public HTTPS target policy                            | Yes       | Yes            | Yes   | Yes      | Live public demo accepted through Browser Run                                      |
| Semantic form inventory and fingerprint               | Yes       | Yes            | Yes   | Yes      | Seven controls and the stable `quote-form` inventory returned through WebMCP       |
| Human-only approval gate                              | Yes       | Yes            | Yes   | Yes      | Public Studio stopped at approval; no artifact existed and only revision remained  |
| State-scoped WebMCP authoring tools                   | Yes       | Yes            | Yes   | Yes      | `inspect_site` → draft/validate → revision-only tool replacement observed          |
| Config-bearing runtime tag                            | Yes       | Yes            | Yes   | Yes      | Final SRI runtime registered `prepare_service_quote` on the public demo            |
| Fill-for-review runtime with zero submit side effects | Yes       | Yes            | Yes   | Yes      | Seven updates, review focus, valid review gate, unchanged URL, no submission       |
| Aggregate proof receipt                               | Yes       | Yes            | Yes   | Yes      | Private UI and `get_proof_summary` both rendered the same `1/1` aggregate          |
| Full authoring-to-installed public journey            | Yes       | Partial        | Yes   | Yes      | Partial: authoring stopped at the human gate; approved artifact and proof verified |
| Origin-trial release-input validation                 | Yes       | Yes            | Yes   | No       | Placeholder, malformed, expired, and incorrectly scoped tokens block deployment    |

## Evidence ledger

| Evidence                        | Result  | Artifact                                                                                                                                                     |
| ------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `vp run ready`                  | Passed  | 89 files formatted; 57 source files linted/type-checked; 17 test files and 55 tests passed; all workspaces built                                             |
| Vite+/Vitest caching            | Passed  | Final gate reported 7/11 Vite+ task cache hits and replayed cached Vitest suites                                                                             |
| Alchemy production deployment   | Passed  | `Alchemy.run` deployed API, demo, Studio, Browser Run binding, Durable Object, custom domains, and redirect                                                  |
| Exact public release            | Passed  | API header reports `aa0a40017c30acfe51a6e98c39ca0b30ec4640e5`                                                                                                |
| Public route policy             | Passed  | `www` 200, demo 200, API reachable, apex 301 to canonical `www`                                                                                              |
| Runtime SRI and CORS            | Passed  | Live runtime bytes equal the built asset; `Access-Control-Allow-Origin: *`; SRI is `sha384-1r4UkjuZeCOzB0Eo4rXiXvoCW2Og+CH2p3WOQRjWLFyLBzSfqPM7QXfuFpFHZ79f` |
| Browser Run inspection          | Passed  | Public `inspect_site` returned Northstar, `/`, `quote-form`, and seven semantic controls                                                                     |
| Public authoring lifecycle      | Passed  | Browser called inspect, draft, and validate; Studio visibly reached approval and replaced tools with revision-only scope                                     |
| Public installed tool           | Passed  | `prepare_service_quote` discovered with a closed seven-field schema at `https://demo.webmcpifier.com/`                                                       |
| Public fill-for-review call     | Passed  | Result was `ready_for_review`, `submissionRequired: true`, `updatedFieldCount: 7`; review opened and closed without submission                               |
| Aggregate proof                 | Passed  | Capability `cap_c04b73f132964dc6b89dd18b525f36f7`: one invocation, one success, zero failures/aborts, ≤100 ms                                                |
| Contract identity               | Passed  | Hash `0f4f6e2bc11bac980c2c5b7813bb052d3e241f1e08af63dd67b19e3a6e600f6e`, runtime `1.0.0`, exact demo origin                                                  |
| Public GitHub repository        | Passed  | `birbprophet/webmcpifier` is public, defaults to `main`, and GitHub reports the MIT license                                                                  |
| Real Chrome origin-trial tokens | Pending | Codex in-app Browser proof passed; registered first-party and third-party Chrome tokens still require the release owner                                      |

The email value is intentionally redacted by the in-app browser's DOM inspection surface. The runtime returned seven updates, the email control reported native validity with no missing/type mismatch, and the page's human review gate opened, which requires the complete form to pass `reportValidity()`. The browser then closed review and observed no `data-human-submitted` marker.

This public run did not cross the human-only approval button in the fresh authoring session. Publication for the installed artifact was exercised separately through the same Effect RPC publication contract, then installed as the one authorized source edit. A continuous video take still requires the release owner to press approval and perform the final Devpost/YouTube actions.
