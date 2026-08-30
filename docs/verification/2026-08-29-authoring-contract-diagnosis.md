# WebMCP authoring-contract diagnosis

Date: 2026-08-29

## Reproduction receipt

- Candidate SHA: `ca9534e97e2e07fce3001de40be5333e1ef786f9`.
- Public seam: `https://www.webmcpifier.com/` in the Codex in-app browser.
- Observation: the registered `inspect_site` JSON Schema contained only `task` and `url`; `validate_draft` required the entire internal camel-case `DraftCapability` object.
- Controlled call: the published `inspect_site` accepted the plan's extra `safety_boundary: "fill_for_review"` value but silently discarded it because Effect Schema strips excess object properties by default.
- Disconfirming evidence: the existing authoring journey still reached approval because Studio injected its own safety constant and agents could follow the implementation-specific camel-case schema. The failure was contract fidelity and strictness, not scanner availability.

## Root-cause receipt

The WebMCP adapter reused internal domain schemas directly. `AgentInspectInput` omitted the safety field, `validate_draft` decoded a resent draft instead of validating Studio's visible current draft, and input decoding did not enable `onExcessProperty: "error"`. Studio and publication also duplicated a shallow binding check that compared only form ID, control name, and kind, while the runtime correctly required exact `required` and option metadata.

The affected scope is the state-owned WebMCP authoring surface and pre-publication validation. Browser Run, Effect RPC transport, the human approval gate, and the installed runtime are separate seams.

## Fixed-forward contract

- Expose the documented snake-case inputs and keep annotations under WebMCPifier control.
- Require `safety_boundary: "fill_for_review"` in the public inspection contract.
- Make `validate_draft({})` validate the draft already visible in Studio.
- Make `revise_form_tool` apply partial changes rather than replace the complete draft.
- Reject excess WebMCP input properties at execution as well as in generated JSON Schema.
- Use one domain matcher for both Studio validation and publication, including required-control coverage and exact kind, required-state, and option metadata.

Confidence: high. The live tool descriptions, direct tool call, source path, and focused regression tests all identify the same causal seam.
