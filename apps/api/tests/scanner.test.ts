import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import fixture from "./fixtures/service-quote.html?raw";
import { browserSiteScanner } from "../src/scanner.ts";
import type { BrowserSnapshotBinding } from "../src/environment.ts";

const publicDns = { assertPublic: () => Effect.void } as const;

it.effect("extracts deterministic semantic form metadata from rendered Browser Run content", () =>
  Effect.gen(function* () {
    const requestedUrls: Array<string> = [];
    const browser: BrowserSnapshotBinding = {
      quickAction: (_action, options) => {
        if ("url" in options) requestedUrls.push(options.url);
        return Promise.resolve(
          Response.json({
            meta: {
              finalUrl: "https://customer.example/quote?server-trace=private",
              headers: { "content-type": "text/html; charset=utf-8" },
              redirectChain: [
                {
                  headers: { location: "/quote?server-trace=private" },
                  status: 302,
                  url: "https://customer.example/quote",
                },
              ],
              status: 200,
              title: "Northstar Home Services",
            },
            result: { content: fixture, screenshot: "AA==" },
            success: true,
          }),
        );
      },
    };
    const scanner = browserSiteScanner(browser, publicDns);
    const first = yield* scanner.inspect({
      safetyBoundary: "fill_for_review",
      task: "Prepare a quote for review.",
      url: "https://customer.example/quote?campaign=private",
    });
    const second = yield* scanner.inspect({
      safetyBoundary: "fill_for_review",
      task: "Prepare a quote for review.",
      url: "https://customer.example/quote?campaign=other",
    });

    expect(requestedUrls).toEqual([
      "https://customer.example/quote",
      "https://customer.example/quote",
    ]);
    expect(first.url).toBe("https://customer.example/quote");
    expect(first.screenshotDataUrl).toBe("data:image/jpeg;base64,AA==");
    expect(first.forms).toEqual(second.forms);
    expect(first.forms[0]?.controls).toEqual([
      { kind: "text", label: "Full name", name: "full_name", options: [], required: true },
      { kind: "email", label: "Email address", name: "email", options: [], required: true },
      {
        kind: "select",
        label: "Service",
        name: "service",
        options: ["plumbing", "electrical"],
        required: true,
      },
      {
        kind: "radio",
        label: "Urgency",
        name: "urgency",
        options: ["routine", "urgent"],
        required: true,
      },
      {
        kind: "textarea",
        label: "Project details",
        name: "details",
        options: [],
        required: false,
      },
    ]);
    expect(JSON.stringify(first)).not.toContain("private fixture");
  }),
);

it.effect("rejects unsupported origin content before exposing inventory", () =>
  Effect.gen(function* () {
    const browser: BrowserSnapshotBinding = {
      quickAction: () =>
        Promise.resolve(
          Response.json({
            meta: {
              finalUrl: "https://customer.example/quote",
              headers: { "content-type": "application/pdf" },
              status: 200,
              title: "Not HTML",
            },
            result: { content: fixture, screenshot: "AA==" },
            success: true,
          }),
        ),
    };
    const result = yield* Effect.exit(
      browserSiteScanner(browser, publicDns).inspect({
        safetyBoundary: "fill_for_review",
        task: "Prepare a quote for review.",
        url: "https://customer.example/quote",
      }),
    );
    expect(result._tag).toBe("Failure");
  }),
);
