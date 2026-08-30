import {
  canonicalFormSignature,
  SCAN_LIMITS,
  ScanFailed,
  SemanticForm,
  sha256Hex,
  type ControlKind,
  type SemanticControl,
} from "@webmcpifier/domain";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { parse, type DefaultTreeAdapterMap } from "parse5";

type Node = DefaultTreeAdapterMap["node"];
type ParentNode = DefaultTreeAdapterMap["parentNode"];
type Element = DefaultTreeAdapterMap["element"];
type TextNode = DefaultTreeAdapterMap["textNode"];

const isElement = (node: Node): node is Element => "tagName" in node;
const isTextNode = (node: Node): node is TextNode => node.nodeName === "#text" && "value" in node;

const childNodes = (node: Node): ReadonlyArray<Node> =>
  "childNodes" in node ? node.childNodes : [];

const descendants = (root: ParentNode): ReadonlyArray<Element> => {
  const elements: Array<Element> = [];
  const visit = (node: Node): void => {
    if (isElement(node)) elements.push(node);
    for (const child of childNodes(node)) visit(child);
  };
  for (const child of root.childNodes) visit(child);
  return elements;
};

const attribute = (element: Element, name: string): string | undefined =>
  element.attrs.find((candidate) => candidate.name === name)?.value;

const hasAttribute = (element: Element, name: string): boolean =>
  element.attrs.some((candidate) => candidate.name === name);

const text = (node: Node): string => {
  if (isTextNode(node)) return node.value;
  if (node.nodeName === "script" || node.nodeName === "style") return "";
  return childNodes(node).map(text).join(" ").replaceAll(/\s+/gu, " ").trim();
};

const labelText = (node: Node): string => {
  if (isTextNode(node)) return node.value;
  if (
    node.nodeName === "script" ||
    node.nodeName === "style" ||
    (isElement(node) &&
      (node.tagName === "input" ||
        node.tagName === "select" ||
        node.tagName === "textarea" ||
        node.tagName === "button" ||
        node.tagName === "small" ||
        attribute(node, "aria-hidden") === "true"))
  ) {
    return "";
  }
  return childNodes(node).map(labelText).join(" ").replaceAll(/\s+/gu, " ").trim();
};

const humanize = (value: string): string =>
  value
    .replaceAll(/[_:.-]+/gu, " ")
    .replaceAll(/\s+/gu, " ")
    .trim()
    .replace(/^./u, (first) => first.toUpperCase());

const nearestLabel = (element: Element): Element | undefined => {
  let parent = element.parentNode;
  while (parent !== null && "nodeName" in parent) {
    if (isElement(parent) && parent.tagName === "label") return parent;
    parent = "parentNode" in parent ? parent.parentNode : null;
  }
  return undefined;
};

const controlLabel = (
  control: Element,
  labelsByTarget: ReadonlyMap<string, string>,
): string | undefined => {
  const id = attribute(control, "id");
  return (
    attribute(control, "aria-label")?.trim() ||
    (id === undefined ? undefined : labelsByTarget.get(id)) ||
    (nearestLabel(control) === undefined ? undefined : labelText(nearestLabel(control)!))
  );
};

const inputKind = (element: Element): ControlKind | undefined => {
  if (element.tagName === "textarea") return "textarea";
  if (element.tagName === "select") return "select";
  if (element.tagName !== "input") return undefined;
  const type = (attribute(element, "type") ?? "text").toLowerCase();
  if (type === "text" || type === "email" || type === "tel" || type === "radio") return type;
  return undefined;
};

const optionValues = (control: Element): ReadonlyArray<string> | undefined => {
  const options = descendants(control).filter(
    (candidate) => candidate.tagName === "option" && !hasAttribute(candidate, "disabled"),
  );
  const values = options.map((candidate) => attribute(candidate, "value"));
  if (values.some((value) => value === undefined)) return undefined;
  return values.filter((value): value is string => value !== undefined && value.length > 0);
};

const radioValue = (control: Element): string | undefined => {
  const value = attribute(control, "value")?.trim();
  return value === undefined || value.length === 0 ? undefined : value;
};

const fieldsetLegend = (element: Element): string | undefined => {
  let parent = element.parentNode;
  while (parent !== null && "nodeName" in parent) {
    if (isElement(parent) && parent.tagName === "fieldset") {
      return descendants(parent)
        .find((candidate) => candidate.tagName === "legend")
        ?.childNodes.map(text)
        .join(" ")
        .trim();
    }
    parent = "parentNode" in parent ? parent.parentNode : null;
  }
  return undefined;
};

const formTitle = (form: Element, formId: string): string =>
  attribute(form, "aria-label")?.trim() ||
  descendants(form)
    .find((candidate) => candidate.tagName === "legend")
    ?.childNodes.map(text)
    .join(" ")
    .trim() ||
  humanize(formId);

const controlsFor = (form: Element): ReadonlyArray<SemanticControl> | undefined => {
  const elements = descendants(form);
  const labelsByTarget = new Map(
    elements
      .filter((element) => element.tagName === "label" && attribute(element, "for") !== undefined)
      .map((element) => [attribute(element, "for")!, labelText(element)] as const),
  );
  const controls = new Map<string, SemanticControl>();

  for (const element of elements) {
    const kind = inputKind(element);
    const name = attribute(element, "name")?.trim();
    if (
      kind === undefined ||
      name === undefined ||
      name.length === 0 ||
      hasAttribute(element, "disabled")
    ) {
      continue;
    }

    const current = controls.get(name);
    if (kind === "radio" && current?.kind === "radio") {
      const option = radioValue(element);
      if (option === undefined || current.options.includes(option)) return undefined;
      controls.set(name, {
        ...current,
        options: [...current.options, option],
        required: current.required || hasAttribute(element, "required"),
      });
      continue;
    }
    if (current !== undefined) return undefined;

    const label =
      kind === "radio"
        ? fieldsetLegend(element) || controlLabel(element, labelsByTarget)
        : controlLabel(element, labelsByTarget);
    if (label === undefined || label.length === 0) return undefined;
    if (kind === "select" && hasAttribute(element, "multiple")) return undefined;
    const radioOption = kind === "radio" ? radioValue(element) : undefined;
    const options = kind === "select" ? optionValues(element) : radioOption ? [radioOption] : [];
    if ((kind === "select" || kind === "radio") && options === undefined) return undefined;
    if ((kind === "select" || kind === "radio") && options?.length === 0) return undefined;
    if (kind === "radio" && radioOption === undefined) return undefined;
    controls.set(name, {
      kind,
      label,
      name,
      options: options ?? [],
      required: hasAttribute(element, "required"),
    });
  }

  const result = Array.from(controls.values());
  return result.length > SCAN_LIMITS.controls ? undefined : result;
};

export const extractSemanticForms = (
  html: string,
): Effect.Effect<ReadonlyArray<SemanticForm>, Schema.SchemaError | ScanFailed> =>
  Effect.gen(function* () {
    const document = parse(html);
    const forms = descendants(document).filter((element) => element.tagName === "form");
    if (forms.length > SCAN_LIMITS.forms) {
      return yield* new ScanFailed({ message: "The page contains too many forms." });
    }
    const extracted = yield* Effect.forEach(forms, (form) =>
      Effect.gen(function* () {
        const formId = (attribute(form, "id") ?? attribute(form, "name") ?? "").trim();
        const controls = controlsFor(form);
        if (controls === undefined) {
          return yield* new ScanFailed({
            message: "A form does not have one stable, labelled control contract.",
          });
        }
        if (formId.length === 0 || controls.length === 0) return undefined;
        const title = formTitle(form, formId);
        const fingerprint = yield* sha256Hex(canonicalFormSignature({ controls, formId, title }));
        return { controls, fingerprint, formId, title };
      }),
    );
    return yield* Schema.decodeUnknownEffect(Schema.Array(SemanticForm))(
      extracted.filter((form) => form !== undefined),
    );
  });
