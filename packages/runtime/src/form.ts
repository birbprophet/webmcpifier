import type { ControlKind, ToolParameter } from "./config.ts";

const MAX_INPUT_LENGTH = 10_000;
const SUPPORTED_INPUT_TYPES = new Set<ControlKind>(["text", "email", "tel", "radio"]);

interface SemanticControl {
  readonly kind: ControlKind;
  readonly name: string;
  readonly options: readonly string[];
  readonly required: boolean;
}

interface BoundParameter {
  readonly controls: readonly FormControl[];
  readonly parameter: ToolParameter;
}

interface PreparedUpdate extends BoundParameter {
  readonly value: string;
}

type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const isSelect = (control: FormControl): control is HTMLSelectElement =>
  control.tagName === "SELECT";

const fail = (): never => {
  throw new Error("The approved form contract no longer matches this page.");
};

const kindOf = (element: Element): ControlKind | undefined => {
  if (element.tagName === "TEXTAREA") return "textarea";
  if (element.tagName === "SELECT") return "select";
  if (element.tagName !== "INPUT") return undefined;
  const type = (element.getAttribute("type") ?? "text").toLowerCase();
  return SUPPORTED_INPUT_TYPES.has(type as ControlKind) ? (type as ControlKind) : undefined;
};

const formControls = (form: HTMLFormElement): readonly FormControl[] =>
  Array.from(form.querySelectorAll<FormControl>("input, select, textarea")).filter(
    (element) => kindOf(element) !== undefined && !element.disabled,
  );

const optionsOf = (controls: readonly FormControl[], kind: ControlKind): readonly string[] => {
  if (kind === "select") {
    const select = controls[0];
    if (select === undefined || !isSelect(select) || select.multiple) return fail();
    const options = Array.from(select.options).filter(({ disabled }) => !disabled);
    if (options.some((option) => !option.hasAttribute("value"))) return fail();
    return options.map(({ value }) => value).filter((value) => value.trim().length > 0);
  }
  if (kind === "radio") {
    return controls.map((control) => {
      if (control.tagName !== "INPUT" || !control.hasAttribute("value")) return fail();
      return control.value;
    });
  }
  return [];
};

const inspectControls = (form: HTMLFormElement): readonly SemanticControl[] => {
  const controls = formControls(form);
  const seen = new Set<string>();
  const result: SemanticControl[] = [];

  for (const control of controls) {
    const name = control.getAttribute("name") ?? "";
    const kind = kindOf(control);
    if (name.length === 0 || kind === undefined || seen.has(name)) continue;
    seen.add(name);
    const namedControls = controls.filter((candidate) => candidate.getAttribute("name") === name);
    if (kind !== "radio" && namedControls.length !== 1) return fail();
    if (namedControls.some((candidate) => kindOf(candidate) !== kind)) return fail();
    result.push({
      kind,
      name,
      options: optionsOf(namedControls, kind),
      required: namedControls.some(({ required }) => required),
    });
  }
  return result;
};

const sha256Hex = async (value: string, crypto: Crypto): Promise<string> => {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const fingerprintForm = (form: HTMLFormElement, crypto: Crypto): Promise<string> => {
  const formId = form.id || form.getAttribute("name") || fail();
  const signature = [
    formId,
    ...inspectControls(form).map((control) =>
      [
        control.name,
        control.kind,
        control.required ? "required" : "optional",
        control.options.join(","),
      ].join(":"),
    ),
  ].join("|");
  return sha256Hex(signature, crypto);
};

const reviewControl = (form: HTMLFormElement): HTMLElement => {
  const marked = form.querySelector<HTMLElement>("[data-webmcpifier-review]");
  if (marked !== null) return marked;
  const submit = Array.from(form.elements).find((element): element is HTMLElement => {
    if (typeof Reflect.get(element, "focus") !== "function") return false;
    return (
      (element.tagName === "BUTTON" &&
        (element.getAttribute("type") ?? "submit").toLowerCase() === "submit") ||
      (element.tagName === "INPUT" &&
        (element.getAttribute("type") ?? "text").toLowerCase() === "submit")
    );
  });
  return submit ?? fail();
};

const arraysEqual = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const bindParameters = (
  form: HTMLFormElement,
  parameters: readonly ToolParameter[],
): readonly BoundParameter[] => {
  const controls = formControls(form);
  return parameters.map((parameter) => {
    const namedControls = controls.filter(
      (control) => control.getAttribute("name") === parameter.controlName,
    );
    if (
      namedControls.length === 0 ||
      (parameter.kind !== "radio" && namedControls.length !== 1) ||
      namedControls.some((control) => kindOf(control) !== parameter.kind) ||
      namedControls.some(({ required }) => required) !== parameter.required ||
      !arraysEqual(optionsOf(namedControls, parameter.kind), parameter.options)
    ) {
      return fail();
    }
    return { controls: namedControls, parameter };
  });
};

const nativeSetter = (
  element: FormControl,
  property: "checked" | "value",
): ((value: unknown) => void) => {
  const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), property);
  if (descriptor?.set === undefined) return fail();
  return (value) => descriptor.set?.call(element, value);
};

const validateNativeConstraints = (control: FormControl, value: string): void => {
  const clone = control.cloneNode(true) as FormControl;
  nativeSetter(clone, "value")(value);
  if (!clone.checkValidity()) fail();
};

const prepareUpdates = (
  bindings: readonly BoundParameter[],
  input: unknown,
): readonly PreparedUpdate[] => {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return fail();
  const values = input as Record<string, unknown>;
  const allowedNames = new Set(bindings.map(({ parameter }) => parameter.name));
  if (Object.keys(values).some((name) => !allowedNames.has(name))) return fail();

  return bindings.flatMap((binding) => {
    const { parameter } = binding;
    if (!Object.hasOwn(values, parameter.name)) {
      if (parameter.required) return fail();
      return [];
    }
    const value = values[parameter.name];
    if (
      typeof value !== "string" ||
      value.length > MAX_INPUT_LENGTH ||
      (parameter.required && value.trim().length === 0) ||
      (parameter.options.length > 0 && !parameter.options.includes(value))
    ) {
      return fail();
    }
    if (parameter.kind !== "radio") validateNativeConstraints(binding.controls[0] ?? fail(), value);
    return [{ ...binding, value }];
  });
};

const throwIfAborted = (signal: AbortSignal): void => {
  if (signal.aborted) throw signal.reason;
};

const dispatchValueEvents = (control: FormControl, signal: AbortSignal): void => {
  const EventConstructor = control.ownerDocument.defaultView?.Event ?? Event;
  control.dispatchEvent(new EventConstructor("input", { bubbles: true }));
  throwIfAborted(signal);
  control.dispatchEvent(new EventConstructor("change", { bubbles: true }));
  throwIfAborted(signal);
};

const applyUpdate = ({ controls, parameter, value }: PreparedUpdate, signal: AbortSignal): void => {
  throwIfAborted(signal);
  if (parameter.kind === "radio") {
    const selected = controls.find(
      (control) => control.tagName === "INPUT" && control.value === value,
    );
    if (selected === undefined) return fail();
    nativeSetter(selected, "checked")(true);
    dispatchValueEvents(selected, signal);
    return;
  }
  const control = controls[0] ?? fail();
  nativeSetter(control, "value")(value);
  dispatchValueEvents(control, signal);
};

export const fillFormForReview = (
  form: HTMLFormElement,
  parameters: readonly ToolParameter[],
  input: unknown,
  signal: AbortSignal,
): number => {
  throwIfAborted(signal);
  const updates = prepareUpdates(bindParameters(form, parameters), input);
  const review = reviewControl(form);
  for (const update of updates) applyUpdate(update, signal);
  throwIfAborted(signal);
  form.scrollIntoView({ block: "center" });
  review.focus({ preventScroll: false });
  throwIfAborted(signal);
  return updates.length;
};

export const inputSchemaFor = (parameters: readonly ToolParameter[]): Record<string, unknown> => {
  const properties = Object.fromEntries(
    parameters.map((parameter) => [
      parameter.name,
      {
        ...(parameter.kind === "email" ? { format: "email" } : {}),
        ...(parameter.options.length > 0 ? { enum: [...parameter.options] } : {}),
        description: parameter.description,
        title: parameter.title,
        type: "string",
      },
    ]),
  );
  return {
    additionalProperties: false,
    properties,
    required: parameters.filter(({ required }) => required).map(({ name }) => name),
    type: "object",
  };
};
