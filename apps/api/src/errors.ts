import * as Schema from "effect/Schema";

// oxlint-disable-next-line unicorn/throw-new-error -- Schema.TaggedError is a curried factory.
export class InvalidEnvironment extends Schema.TaggedError<InvalidEnvironment>()(
  "InvalidEnvironment",
  { message: Schema.NonEmptyString },
) {}

// oxlint-disable-next-line unicorn/throw-new-error -- Schema.TaggedError is a curried factory.
export class ProofDenied extends Schema.TaggedError<ProofDenied>()("ProofDenied", {
  message: Schema.NonEmptyString,
}) {}

// oxlint-disable-next-line unicorn/throw-new-error -- Schema.TaggedError is a curried factory.
export class ProofConflict extends Schema.TaggedError<ProofConflict>()("ProofConflict", {
  message: Schema.NonEmptyString,
}) {}
