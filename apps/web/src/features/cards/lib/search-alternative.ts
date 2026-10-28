import { looksLikeCardNumber } from "@openrift/shared/search-query/keys";
import { parseSearchQuery } from "@openrift/shared/search-query/parse";

export function searchAlternative(query: string): string | null {
  const { root } = parseSearchQuery(query);
  if (!root) {
    return null;
  }
  const terms = root.kind === "and" ? root.children : [root];
  const words: string[] = [];
  for (const term of terms) {
    if (term.kind !== "text") {
      return null;
    }
    words.push(term.value.replaceAll('"', ""));
  }
  if (words.every((word) => looksLikeCardNumber(word))) {
    return null;
  }
  const text = words.join(" ");
  return /\s/u.test(text) ? `o:"${text}"` : `o:${text}`;
}
