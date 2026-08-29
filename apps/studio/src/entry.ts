import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { Runtime } from "foldkit";
import { injectFirstPartyOriginTrialToken } from "./environment.ts";
import { init, Model, ReceiptReference, StudioFlags, update } from "./main.ts";
import { studioRpcLayer } from "./rpc.ts";
import "./styles.css";
import { subscriptions } from "./webmcp.ts";
import { view } from "./view.ts";

const RECEIPT_PATH_PREFIX = "/receipt/";

injectFirstPartyOriginTrialToken(document);

const decodePathSegment = (value: string): Option.Option<string> => {
  try {
    return Option.some(decodeURIComponent(value));
  } catch {
    return Option.none();
  }
};

export const flagsFromLocation = (pathname: string, hash: string): StudioFlags => {
  if (!pathname.startsWith(RECEIPT_PATH_PREFIX)) {
    return { _tag: "Studio" };
  }
  const receipt = Option.flatMap(
    decodePathSegment(pathname.slice(RECEIPT_PATH_PREFIX.length)),
    (capabilityId) =>
      Schema.decodeUnknownOption(ReceiptReference)({
        capabilityId,
        readToken: hash.startsWith("#") ? hash.slice(1) : hash,
      }),
  );
  return Option.match(receipt, {
    onNone: () => ({ _tag: "Studio" }),
    onSome: (validReceipt) => ({ _tag: "Receipt", receipt: validReceipt }),
  });
};

const root = document.querySelector("#root");

if (!(root instanceof HTMLElement)) {
  throw new Error("WebMCPifier studio requires #root");
}

const application = Runtime.makeApplication({
  Flags: StudioFlags,
  Model,
  container: root,
  init,
  resources: studioRpcLayer,
  subscriptions,
  update,
  view,
});

Runtime.run(application, {
  flags: Effect.succeed(flagsFromLocation(window.location.pathname, window.location.hash)),
});
