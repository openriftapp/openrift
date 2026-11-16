import type { Locale } from "@/paraglide/runtime.js";
import { getLocale } from "@/paraglide/runtime.js";

import type { ListType } from "./list-patterns.gen";
import { LIST_PATTERNS } from "./list-patterns.gen";

function fill(pattern: string, first: string, second: string): string {
  return pattern.replaceAll(/\{[01]\}/gu, (slot) => (slot === "{0}" ? first : second));
}

/** Not `Intl.ListFormat`: server and browser ICU can differ, which breaks hydration. */
export function formatList(
  items: readonly string[],
  type: ListType = "and",
  locale: Locale = getLocale(),
): string {
  const pattern = LIST_PATTERNS[locale][type];
  const [first, second, ...others] = items;
  if (first === undefined) {
    return "";
  }
  if (second === undefined) {
    return first;
  }
  if (others.length === 0) {
    return fill(pattern.pair, first, second);
  }
  const rest = [second, ...others];
  const tail = rest.reduceRight((joined, item, index) => {
    if (index === rest.length - 1) {
      return item;
    }
    return fill(index === rest.length - 2 ? pattern.end : pattern.middle, item, joined);
  }, "");
  return fill(pattern.start, first, tail);
}
