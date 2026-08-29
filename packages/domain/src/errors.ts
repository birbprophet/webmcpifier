import * as Schema from "effect/Schema";

// oxlint-disable-next-line unicorn/throw-new-error -- Schema.TaggedError is a curried factory.
export class InvalidTarget extends Schema.TaggedError<InvalidTarget>()("InvalidTarget", {
  message: Schema.NonEmptyString,
}) {}

// oxlint-disable-next-line unicorn/throw-new-error -- Schema.TaggedError is a curried factory.
export class ScanFailed extends Schema.TaggedError<ScanFailed>()("ScanFailed", {
  message: Schema.NonEmptyString,
}) {}

// oxlint-disable-next-line unicorn/throw-new-error -- Schema.TaggedError is a curried factory.
export class DraftRejected extends Schema.TaggedError<DraftRejected>()("DraftRejected", {
  message: Schema.NonEmptyString,
}) {}

// oxlint-disable-next-line unicorn/throw-new-error -- Schema.TaggedError is a curried factory.
export class PublicationFailed extends Schema.TaggedError<PublicationFailed>()(
  "PublicationFailed",
  { message: Schema.NonEmptyString },
) {}

// oxlint-disable-next-line unicorn/throw-new-error -- Schema.TaggedError is a curried factory.
export class ProofUnavailable extends Schema.TaggedError<ProofUnavailable>()("ProofUnavailable", {
  message: Schema.NonEmptyString,
}) {}
