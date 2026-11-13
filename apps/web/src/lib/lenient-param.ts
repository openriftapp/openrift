import { z } from "zod/mini";

export function lenient<T extends z.core.SomeType>(schema: T) {
  // The router parses a hand-typed `?q=123` into a number, so a string field reads it back as text.
  const numberAsText = z.pipe(
    z.pipe(z.number(), z.transform(String)),
    schema as unknown as z.ZodMiniType<z.output<T>, string>,
  );
  // oxlint-disable-next-line unicorn/no-useless-undefined, promise/valid-params -- zod's catch takes the schema and its fallback
  return z.catch(z.optional(z.union([schema, numberAsText])), undefined);
}
