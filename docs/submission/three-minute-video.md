# WebMCPifier three-minute video

Record only real public actions. Trim deployment wait, but do not replace any authoring, approval, installation, tool call, or proof step with a mock.

## Pre-record release sequence

1. Put the registered first-party and third-party WebMCP tokens in the ignored release environment file. Do not print them in logs.
2. Remove only the previously generated WebMCPifier tag from the demo HTML shell and deploy the clean pre-install state through `vp run deploy --stage prod --env-file .env.release`.
3. In generic Chrome, verify the Studio has WebMCP and the public demo has no tools. Start the recording from this deployed state.
4. During the recording, complete authoring and press the human approval control. Use the returned installation skill to add the newly generated tag; never reuse or hand-edit an older tag because the token participates in the capability hash.
5. Commit the one authorized demo source edit and run the same Alchemy deployment command. Trim only the build/deploy wait from the video.
6. Complete the installed-tool and private-receipt proof, then freeze the final repository SHA and deployment together.

## Shot list and narration

### 0:00-0:15 — Before

Open `https://demo.webmcpifier.com` and ask the browser agent which WebMCP tools the page exposes.

Narration: “This ordinary home-services site has a semantic quote form, but it exposes no tools to a browser agent.”

### 0:15-0:35 — Intent

Open `https://www.webmcpifier.com` and send:

> Inspect https://demo.webmcpifier.com and draft a tool named prepare_service_quote that fills the service quote for review and never submits it.

Narration: “WebMCPifier does not host another model. I describe one task to the browser agent I already use, and that agent calls WebMCPifier through WebMCP.”

### 0:35-1:10 — Inspect, define, validate

Show the Studio progressing through Inspect and Define. Hold briefly on the screenshot, bounded form inventory, stable identifiers, closed parameter schema, annotations, fingerprint, and safety policy.

Narration: “Browser Run inspects the rendered public page. The compiler accepts one well-labelled form with stable identifiers. It generates no selectors, click macros, or arbitrary JavaScript. Scanned labels remain untrusted content, while WebMCPifier controls the tool metadata.”

### 1:10-1:25 — Human approval

Hold on the guarantee “fills for review; never submits,” then click **Approve capability** yourself.

Narration: “No installation artifact exists until I approve this exact contract. The browser agent cannot cross this gate.”

### 1:25-1:45 — Install

Ask for the installation skill, show the generated tag and receipt link, then show Codex applying the one authorized source edit. Trim only the Alchemy build and deployment wait.

Narration: “The result is one config-bearing, version-pinned script tag with integrity protection, plus a textual installation skill that tells Codex where it may edit, how to discover the existing build and deployment commands, and when to stop and ask.”

### 1:45-2:20 — Use the new tool

Reopen the same public demo URL, discover `prepare_service_quote`, and call it with:

> Prepare a plumbing service quote for Alex Chen at alex@example.test. It is urgent, for a house, postcode TEST 1AA, and the details are: Demonstration leak under the kitchen sink. Do not submit it.

Narration: “The installed runtime rechecks the exact origin, path, form fingerprint, and every argument before it touches the page.”

### 2:20-2:40 — Safety outcome

Show every value filled, the form scrolled into view, and focus on **Review request**. Show that there is no submitted state or confirmation.

Narration: “The tool dispatches native input and change events, but it cannot click, submit, call requestSubmit, or invoke the form action. The request is waiting for a human review.”

### 2:40-2:55 — Proof

Open the private receipt fragment and refresh it. Show one successful invocation, its latency bucket, runtime version, origin, contract hash, and last-seen time.

Narration: “The receipt stores aggregate proof only. No names, emails, form values, arguments, outputs, cookies, query strings, or claimed agent identity are recorded.”

### 2:55-3:00 — Thesis

End on the Studio wordmark and the five states.

Narration: “WebMCPifier: describe it, approve it, paste it, prove it.”

## Capture checklist

- Record at 1080p or higher with browser zoom fixed and notifications hidden.
- Keep the customer URL visible before and after installation.
- Make the human approval click and no-submission state visually unambiguous.
- Use only the fictional values in this script.
- Keep the private receipt fragment out of repository files, logs, and video descriptions.
- Export under three minutes, listen through the final audio, then upload publicly to YouTube.
