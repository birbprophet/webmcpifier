import { installRuntime } from "./runtime.ts";

void installRuntime(document, document.currentScript as HTMLScriptElement | null, {
  crypto,
  fetch: window.fetch.bind(window),
  now: () => performance.now(),
}).catch(() => {
  // The installed runtime never changes page behavior when its contract cannot be established.
});
