import { z } from "zod/mini";

export function lenient<T extends z.core.SomeType>(schema: T) {
  // oxlint-disable-next-line unicorn/no-useless-undefined, promise/valid-params -- zod's catch takes the schema and its fallback
  return z.catch(z.optional(schema), undefined);
}
