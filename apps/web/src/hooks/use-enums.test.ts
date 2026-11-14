import { DEFAULT_RARITY_COLORS } from "@openrift/shared/rarity-colors";
import type * as ReactQuery from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useEnumOrders } from "./use-enums";

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactQuery>()),
  useSuspenseQuery: () => ({
    data: {
      enums: {
        rarities: [
          { slug: "common", label: "Common", sortOrder: 0, color: null },
          { slug: "rare", label: "Rare", sortOrder: 2, color: "#123456" },
        ],
      },
    },
  }),
}));

describe("useEnumOrders", () => {
  it("keeps a rarity's stored colour and fills a missing one from the defaults", () => {
    const { result } = renderHook(() => useEnumOrders());
    expect(result.current.rarityColors).toEqual({ ...DEFAULT_RARITY_COLORS, rare: "#123456" });
    expect(result.current.rarityColors.common).toBe("#A6A6A6");
  });
});
