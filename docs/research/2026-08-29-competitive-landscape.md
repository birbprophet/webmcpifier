# WebMCPifier competitive landscape

Date observed: 2026-08-29

This is a dated comparison of the products' public claims, not an evaluation of private or unannounced capabilities. Links point to the public surface observed on the date above.

## Observed products

| Product                                 | Publicly described workflow                                                                                                                                   | Where it overlaps                                                                    | Boundary relative to WebMCPifier v1                                                                                                                                                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Keak WebMCP](https://agents.keak.com/) | Crawl a URL, generate multiple tools, install one script, monitor use, and A/B test tool definitions.                                                         | URL scanning, generated tools, a script tag, and usage metrics.                      | Keak is positioned as broad discovery and optimization. WebMCPifier deliberately authors one reviewed, non-submitting form capability through WebMCP tools exposed by the authoring studio itself.                                                     |
| [Conscriba](https://conscriba.com/)     | Automated scans, candidate review, snippet installation, analytics, conversion tracking, and A/B testing across common site builders.                         | Scanning, candidate review, installation, and analytics.                             | Conscriba is positioned as a website analytics and optimization product. WebMCPifier v1 stores metadata-only aggregate proof and does not claim agent attribution, conversion tracking, or A/B testing.                                                |
| [Latch](https://latch.tools/)           | A generic static script detects search, cart, navigation, and forms at runtime and registers tools, including actions that can click or submit.               | One-line installation, feature detection, form mapping, and metadata-only analytics. | Latch is automatic and generic at page runtime. WebMCPifier compiles an origin-, path-, schema-, and fingerprint-bound capability and limits its only action to filling for human review without clicking or submitting.                               |
| [webmcp.com](https://webmcp.com/)       | A directory and scanner for WebMCP sites, plus prompts and agent-kit installation for deeper code integration.                                                | Site scanning, suggested tools, and coding-agent guidance.                           | The public directory's own listed tools do not describe the scanner as a stateful authoring API. WebMCPifier's authoring workflow is itself a changing WebMCP tool surface with a required visible approval gate and a generated install artifact.     |
| [webmcpify](https://webmcpify.at/)      | An installable coding-agent skill inventories a repository, obtains manifest approval, integrates tools into source, and verifies or heals them in a browser. | Agent-driven authoring, approval, source edits, and real-browser verification.       | webmcpify starts inside the target repository and produces repo-native integration. WebMCPifier starts from a public page inside the browser, compiles one bounded runtime config, and returns one source edit plus a private aggregate proof receipt. |

## Product thesis after comparison

Scanner plus snippet is not a sufficient distinction. The narrow, demonstrable thesis is:

> A browser agent can call WebMCPifier's WebMCP tools to inspect a different public site, draft one safe capability, pause for human approval, receive one auditable installation edit, and then prove the installed tool on that same public page.

The recursive authoring surface is the product. The scanner, tag, and receipt are supporting mechanisms.

## Explicit non-claims

- WebMCPifier does not claim to be the first scanner, snippet installer, WebMCP agent skill, verification harness, or analytics surface.
- It does not infer trustworthy agent identity. The WebMCP execution callback does not provide one.
- It does not crawl a whole site, generate arbitrary selectors or JavaScript, click controls, submit forms, or optimize tool definitions.
- The comparison does not claim competitors cannot add similar capabilities; it records only the public surfaces observed on the date above.
