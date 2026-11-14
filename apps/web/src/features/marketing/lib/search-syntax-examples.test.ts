import { parseSearchQuery } from "@openrift/shared/search-query/parse";
import { describe, expect, it } from "vitest";

import { searchSyntaxSections } from "@/features/marketing/lib/search-syntax-examples";

const examples = searchSyntaxSections().flatMap((section) =>
  section.examples.map((example) => ({ section: section.id, query: example.query })),
);

describe("search syntax help examples", () => {
  it.each(examples.filter((example) => example.section !== "ignored"))(
    "$query parses without a warning",
    ({ query }) => {
      expect(parseSearchQuery(query).diagnostics).toEqual([]);
    },
  );

  it("shows an unknown key in the ignored-terms section that does warn", () => {
    const warned = examples
      .filter((example) => example.section === "ignored")
      .filter(({ query }) => parseSearchQuery(query).diagnostics.length > 0);

    expect(warned).not.toEqual([]);
  });
});
