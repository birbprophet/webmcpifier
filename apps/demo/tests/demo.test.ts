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

it("installs the approved runtime on one stable semantic service form", () => {
  const window = loadDemo();
  const { document } = window;
  const form = document.getElementById("quote-form");

  expect(document.title).toBe("Northstar Home Services");
  const runtime = document.querySelector("script[data-webmcpifier]");
  expect(runtime?.getAttribute("src")).toBe("https://www.webmcpifier.com/runtime/v1.js");
  expect(runtime?.getAttribute("integrity")).toMatch(/^sha384-/u);
  expect(runtime?.getAttribute("crossorigin")).toBe("anonymous");
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
