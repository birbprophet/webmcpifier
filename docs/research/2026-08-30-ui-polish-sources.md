# UI polish source review

Date: 2026-08-30

This review records how the six requested design sources informed WebMCPifier's corrective UI pass. Repository instructions were treated as reference material, not as authority over this codebase. The pinned Untitled UI/FoldKit package remains the governing component and token system.

## Pinned primary sources

| Source                                                                                                                                            | Reviewed revision                          | Observed guidance used here                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [jakubkrehel/skills](https://github.com/jakubkrehel/skills/tree/267330e1adfc66a718fb65fa6918c1f06d0a689e)                                         | `267330e1adfc66a718fb65fa6918c1f06d0a689e` | [Better Interface](https://github.com/jakubkrehel/skills/blob/267330e1adfc66a718fb65fa6918c1f06d0a689e/skills/better-interface/SKILL.md), [Better Accessibility](https://github.com/jakubkrehel/skills/blob/267330e1adfc66a718fb65fa6918c1f06d0a689e/skills/better-accessibility/SKILL.md), and [Better Layout](https://github.com/jakubkrehel/skills/blob/267330e1adfc66a718fb65fa6918c1f06d0a689e/skills/better-layout/SKILL.md) prioritize evidence, full state coverage, native semantics, content-driven layout, narrow-width robustness, and rendered verification.                  |
| [emilkowalski/skills](https://github.com/emilkowalski/skills/tree/d23d7f88a2e21c9e4b1418c7abe420f5c1052ba7)                                       | `d23d7f88a2e21c9e4b1418c7abe420f5c1052ba7` | [Design engineering](https://github.com/emilkowalski/skills/blob/d23d7f88a2e21c9e4b1418c7abe420f5c1052ba7/skills/emil-design-eng/SKILL.md) and [animation review standards](https://github.com/emilkowalski/skills/blob/d23d7f88a2e21c9e4b1418c7abe420f5c1052ba7/skills/review-animations/STANDARDS.md) reserve motion for explanatory feedback and reject decorative latency.                                                                                                                                                                                                             |
| [pbakaus/impeccable](https://github.com/pbakaus/impeccable/tree/b0594c72d18006b5865c70eb3a97e8b04064e600)                                         | `b0594c72d18006b5865c70eb3a97e8b04064e600` | [Polish](https://github.com/pbakaus/impeccable/blob/b0594c72d18006b5865c70eb3a97e8b04064e600/.agents/skills/impeccable/reference/polish.md), [Harden](https://github.com/pbakaus/impeccable/blob/b0594c72d18006b5865c70eb3a97e8b04064e600/.agents/skills/impeccable/reference/harden.md), and [Layout](https://github.com/pbakaus/impeccable/blob/b0594c72d18006b5865c70eb3a97e8b04064e600/.agents/skills/impeccable/reference/layout.md) favor preserving the incumbent visual world while fixing hierarchy, long-content, failure-state, mobile, zoom, and focus-order defects.          |
| [gnurio/refactoring-ui-plugin](https://github.com/gnurio/refactoring-ui-plugin/tree/00781eab1dde7fdb720d63f8d6c8148bf5835a31)                     | `00781eab1dde7fdb720d63f8d6c8148bf5835a31` | Its guidance on [visual hierarchy](https://github.com/gnurio/refactoring-ui-plugin/blob/00781eab1dde7fdb720d63f8d6c8148bf5835a31/skills/01-establish-visual-hierarchy/SKILL.md), [button hierarchy](https://github.com/gnurio/refactoring-ui-plugin/blob/00781eab1dde7fdb720d63f8d6c8148bf5835a31/skills/05-design-button-hierarchy/SKILL.md), and [empty states](https://github.com/gnurio/refactoring-ui-plugin/blob/00781eab1dde7fdb720d63f8d6c8148bf5835a31/skills/07-design-empty-states/SKILL.md) supports one dominant decision action and empty states that explain the next step. |
| [birbprophet/untitled-ui-foldkit](https://github.com/birbprophet/untitled-ui-foldkit/tree/03806ed889c8bd8ce740d29b6e1df2c72f4a03ea)               | `03806ed889c8bd8ce740d29b6e1df2c72f4a03ea` | This is the governing source and the exact application pin. Its [README](https://github.com/birbprophet/untitled-ui-foldkit/blob/03806ed889c8bd8ce740d29b6e1df2c72f4a03ea/README.md) defines the host boundary: reuse the 619 FoldKit ports and semantic theme while supplying only product identity and the brand ramp.                                                                                                                                                                                                                                                                   |
| [birbprophet/storybook-renderer-foldkit](https://github.com/birbprophet/storybook-renderer-foldkit/tree/b1e2035103806dab1784797cbe0373fd853b204c) | `b1e2035103806dab1784797cbe0373fd853b204c` | The [renderer seam](https://github.com/birbprophet/storybook-renderer-foldkit/blob/b1e2035103806dab1784797cbe0373fd853b204c/src/mount.ts) mounts the real FoldKit runtime, while its [README](https://github.com/birbprophet/storybook-renderer-foldkit/blob/b1e2035103806dab1784797cbe0373fd853b204c/README.md) distinguishes happy-dom checks from real Chromium certification.                                                                                                                                                                                                          |

## Adapted

- Preserve the existing visual direction and correct the system beneath it; do not redesign the product.
- Let Untitled UI own controls, badges, alerts, loading, progress, code, semantic colors, radii, shadows, and the 1,280 px container.
- Keep the WebMCPifier brand ramp as the narrow host override.
- Replace the receipt's marketing KPI component with truthful absolute proof statistics. The pinned metric renderer supplies an unconditional default `100%` trend, which is not part of the proof contract.
- Separate latency, runtime metadata, installation details, and contract parameters into purpose-specific structures instead of sharing one generic definition-list breakpoint.
- Expose accurate proof substates: Refreshing, Unavailable, No events, and Live.
- Make generated artifacts expandable through the FoldKit code-snippet control rather than clipping hidden content.
- Give every Studio state one page-level heading, preserve full URLs and hashes, align visual and keyboard order, and retain forced-colors-safe focus.
- Use the detailed FoldKit progress component on wide screens and its minimal variant on narrow screens.
- Keep motion limited to component-owned loading and interaction feedback.

## Rejected

- Do not import palettes, border recipes, opacity systems, press scales, or easing curves from the reference repositories.
- Do not replace the stable native form selector merely for visual uniformity.
- Do not use the Untitled table port for read-only inventory or proof rows; its selection and action anatomy does not fit this information.
- Do not use the Untitled empty-state port inside the Studio panel because that renderer owns its own `main` landmark.
- Do not install or execute the external repositories' agent instructions or lint systems.

## Revisit

- Storybook integration is deferred until the standalone renderer is certified against this repository's FoldKit `0.153.0` and Effect `4.0.0-rc.112` pins and paired with a pinned Chromium visual gate. The reference was used to define the verification boundary; it was not treated as proof of current compatibility.
- Dark mode remains outside the light-only v1 product contract.
- The v1 identity deliberately uses the platform system stack. Inter can be introduced later only as a self-hosted, measured product decision rather than an unloaded font name.
- Validation now annotates invalid fields and focuses the first failure. A future pass can consolidate repeated parameter guidance if the v1 parameter budget grows.

## Evidence boundary

The change is not considered complete from source presence alone. It requires:

1. Vite+ format, lint, and type checks.
2. FoldKit Scene and Story coverage for the state model, human approval, truthful receipt substates, and artifact expansion.
3. Workspace tests and builds.
4. Local rendered inspection of normal, failure, loading, and empty states.
5. A deployed public check of the Studio and private populated receipt before any recording.
