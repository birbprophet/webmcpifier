import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { SubresourceIntegrity } from "../packages/domain/src/index.ts";

const VerificationEnvironment = Schema.Struct({
  EXPECTED_RUNTIME_INTEGRITY: SubresourceIntegrity,
  RUNTIME_FILE: Schema.NonEmptyString,
});

const program = Effect.gen(function* () {
  const environment = yield* Schema.decodeUnknownEffect(VerificationEnvironment)({
    EXPECTED_RUNTIME_INTEGRITY: process.env.EXPECTED_RUNTIME_INTEGRITY,
    RUNTIME_FILE: process.env.RUNTIME_FILE,
  });
  const runtime = yield* Effect.tryPromise(() => readFile(environment.RUNTIME_FILE));
  const actual = `sha384-${createHash("sha384").update(runtime).digest("base64")}`;
  if (actual !== environment.EXPECTED_RUNTIME_INTEGRITY) {
    return yield* Effect.fail(
      new Error("WEBMCPIFIER_RUNTIME_INTEGRITY does not match the built runtime."),
    );
  }
});

await Effect.runPromise(program);
