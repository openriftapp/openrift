import { m } from "@/paraglide/messages.js";

const NAMED_LIMIT = 3;

export function summarizeListNames(names: readonly string[]): string {
  if (names.length > NAMED_LIMIT) {
    return m.extension_overlay_lists_and_more({
      names: names.slice(0, NAMED_LIMIT).join(", "),
      count: names.length - NAMED_LIMIT,
    });
  }
  if (names.length > 1) {
    return m.extension_overlay_lists_and_last({
      names: names.slice(0, -1).join(", "),
      last: names.at(-1) ?? "",
    });
  }
  return names.at(0) ?? "";
}
