import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UNCLASSIFIED_TAG_GROUP } from "@/features/collections/lib/tag-category-groups";

vi.mock("@/hooks/use-enums", () => ({
  useTagCategories: () => ({
    categories: [{ slug: "region", label: "Region", sortOrder: 0 }],
    categoryByTag: new Map([["Ionia", "region"]]),
  }),
  useCustomTagList: () => ({
    all: [{ slug: "deck-a", category: "decks" }],
    byCategory: new Map(),
  }),
}));

const { useTagGroupResolvers } = await import("./use-tag-group-resolvers");

describe("useTagGroupResolvers", () => {
  it("resolves tags to their category with an Other fallback", () => {
    const { result } = renderHook(() => useTagGroupResolvers());
    expect(result.current.tagGroup("Ionia")).toBe("region");
    expect(result.current.tagGroup("Poro")).toBe(UNCLASSIFIED_TAG_GROUP);
  });

  it("resolves custom tag slugs to their category and leaves unknown slugs out", () => {
    const { result } = renderHook(() => useTagGroupResolvers());
    expect(result.current.customTagGroup("deck-a")).toBe("decks");
    expect(result.current.customTagGroup("gone")).toBeUndefined();
  });
});
