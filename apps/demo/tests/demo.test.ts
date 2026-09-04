import { expect, it } from "@effect/vitest";
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";

const loadDemo = (): Window => {
  const window = new Window({
    settings: { disableCSSFileLoading: true, disableJavaScriptFileLoading: true },
    url: "https://demo.webmcpifier.com/",
  });
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  window.document.write(html);
  window.document.close();
  return window;
};

it("keeps the semantic service form in its clean pre-install state", () => {
  const window = loadDemo();
  const { document } = window;
  const form = document.getElementById("quote-form");

  expect(document.title).toBe("Northstar Home Services");
  expect(document.querySelector("script[data-webmcpifier]")).toBeNull();
  expect(
    document.querySelector('script[src="https://www.webmcpifier.com/runtime/v1.js"]'),
  ).toBeNull();
  expect(form?.tagName).toBe("FORM");
  expect(form?.getAttribute("aria-labelledby")).toBe("review-request-title");
  expect(form?.getAttribute("tabindex")).toBe("-1");

  const expectedControls = [
    ["service", "SELECT"],
    ["urgency", "SELECT"],
    ["propertyType", "SELECT"],
    ["postcode", "INPUT"],
    ["details", "TEXTAREA"],
    ["name", "INPUT"],
    ["email", "INPUT"],
  ] as const;
  for (const [identifier, tagName] of expectedControls) {
    const control = document.getElementById(identifier) as
      | HTMLInputElement
      | HTMLSelectElement
      | HTMLTextAreaElement
      | null;
    expect(control?.tagName).toBe(tagName);
    expect(control?.name).toBe(identifier);
    expect(control?.required).toBe(true);
  }
});

it("keeps submission as an explicit human-only step", () => {
  const window = loadDemo();
  const document = window.document as unknown as Document;
  const form = document.querySelector<HTMLFormElement>("#quote-form");
  if (form === null) throw new Error("Demo form is missing.");
  const review = form.querySelector("[data-webmcpifier-review]");
  const submit = document.querySelector("button[type=submit][form=quote-form]");

  expect(form.method).toBe("post");
  expect(form.action).toBe("https://demo.webmcpifier.com/request-received");
  expect(review?.textContent).toContain("Review request");
  expect(submit?.textContent).toContain("Send request");
  expect(window.document.body.textContent).toContain("only you can review and send it");
  expect(window.document.body.textContent).toContain(
    "Nothing is booked or submitted automatically",
  );
});
