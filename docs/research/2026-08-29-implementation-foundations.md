# WebMCPifier implementation foundations

Date: 2026-08-29

This note records the primary-source decisions used to implement the hackathon build. It distinguishes what the sources say from what WebMCPifier chooses.

## Question

What is the smallest architecture that can compile one semantic form into a safe, installable WebMCP tool and prove the public journey end to end?

## Observed facts

- The current WebMCP draft exposes `document.modelContext.registerTool`, `getTools`, and `executeTool`. Registration accepts an `AbortSignal`; execution receives a distinct `AbortSignal`. Tool changes are asynchronous, and immediate unregister/re-register with the same name has a documented race. Source: [WebMCP draft](https://webmachinelearning.github.io/webmcp/).
- WebMCP tool metadata is agent context. The draft and Chrome guidance treat metadata and returned page content as prompt-injection surfaces. The draft currently defines `readOnlyHint` and `untrustedContentHint`. Sources: [WebMCP security considerations](https://webmachinelearning.github.io/webmcp/#security-and-privacy-considerations) and [Chrome WebMCP best practices](https://developer.chrome.com/docs/ai/webmcp/best-practices).
- Alchemy's Effect RPC pattern shares Schema-backed domain values and tagged errors between client and server, constructs handlers during the Worker initialization phase, and exposes an `HttpEffect`. Its FoldKit website resource preserves the app's Vite configuration and supplies SPA fallback. Sources: [Alchemy Effect RPC](https://alchemy.run/cloudflare/apis/effect-rpc/) and [Alchemy FoldKit](https://alchemy.run/cloudflare/frontend/foldkit/).
- Cloudflare Browser Run can provide rendered content and screenshots through a Worker binding. Durable Objects provide a strongly consistent per-capability storage atom and one replaceable alarm per object. Sources: [Browser Run Quick Actions](https://developers.cloudflare.com/browser-run/quick-actions/) and [Durable Objects best practices](https://developers.cloudflare.com/durable-objects/best-practices/).
- `@effect/vitest` supplies Effect-aware tests and Layer sharing. Vitest 4.0.11+ can persist transformed modules with `experimental.fsModuleCache`; browser tests do not use that cache. Sources: [Effect v4 Vitest API](https://www.effect.website/docs/v4/api/vitest/index) and [Vitest experimental config](https://vitest.dev/config/experimental.html).
- The requested coding guidance favors explicit assumptions, the minimum code that solves the stated problem, surgical changes, and verification against named outcomes. Its strict review companion treats avoidable branches, thin wrappers, cast-heavy boundaries, and misplaced logic as blockers. Sources: [Karpathy coding guidelines](https://github.com/multica-ai/andrej-karpathy-skills/blob/main/CLAUDE.md) and [thermo-nuclear code-quality review](https://github.com/cursor/plugins/blob/main/cursor-team-kit/skills/thermo-nuclear-code-quality-review/SKILL.md).

## Adapt

- Keep one shared `packages/domain` authority for Schema classes, RPC declarations, state, constants, and tagged failures.
- Keep scanning behind one adapter. Local tests use deterministic fixtures; production uses Browser Run.
- Keep installation behind one dependency-free runtime with a versioned config and exact origin/path/fingerprint checks.
- Keep proof in one Durable Object per capability. The object stores aggregates only and deletes itself after inactivity.
- Abort state-owned WebMCP registrations before registering the next state's disjoint tool names. Do not implement a compatibility registry.
- Decode every external value once at its boundary: URLs, DOM inventory, RPC payloads, runtime config, telemetry, and environment.
- Use `@effect/vitest` as the only test import and enable Vite+/Vitest caches where their invalidation model is sound.

## Reject

- Whole-site crawling, arbitrary selector generation, arbitrary JavaScript, click macros, and form submission.
- Optional environment variables or silent configuration fallbacks.
- A provider-independent scanner framework with only one production provider and one fixture adapter.
- A second REST contract beside Effect RPC. Runtime telemetry remains a tiny public endpoint because the installed dependency-free script must not ship Effect.
- Astro for the hydrated studio. The demo remains ordinary Vite and semantic HTML.
- Wrapper modules that merely rename Effect, FoldKit, Alchemy, or platform APIs.

## Revisit after the hackathon

- Multiple pages or tools per capability.
- Account ownership and durable project history.
- Authenticated scanning and source-repository installation.
- Rich analytics, agent attribution, A/B testing, and submission actions.

## Acceptance criteria

- A fixture and the public demo expose no tool before installation and exactly one expected tool after installation.
- The generated runtime refuses origin, path, schema, or fingerprint drift.
- A valid call sets native values, emits `input` and `change`, focuses review, and performs no submit or network effect other than metadata-only telemetry.
- Studio installation artifacts cannot exist until the user presses the approval control.
- The authoring surface changes with studio state and old registrations are aborted.
- All tests import only `@effect/vitest`; the lint gate rejects raw Vitest imports.
- All deployed resources are created through `alchemy.run.ts` and the public journey is browser-verified.
