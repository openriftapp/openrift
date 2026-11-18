// @vitest-environment jsdom
import { DEFAULT_RARITY_COLORS } from "@openrift/shared/rarity-colors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook, screen } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { describe, expect, it } from "vitest";

import { initKeys } from "@/lib/query-keys";
import { stubInitResponse } from "@/test/init-fixtures";

import { useEnumOrders, useLanguageList, useZoneOrder } from "./use-enums";

function clientWith(init = stubInitResponse()) {
  const client = new QueryClient();
  client.setQueryData(initKeys.all, init);
  return client;
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useEnumOrders", () => {
  it("keeps a rarity's stored colour and fills a missing one from the defaults", () => {
    const client = clientWith(
      stubInitResponse({
        rarities: [
          { slug: "common", label: "Common", sortOrder: 0, color: null },
          { slug: "rare", label: "Rare", sortOrder: 2, color: "#123456" },
        ],
      }),
    );
    const { result } = renderHook(() => useEnumOrders(), { wrapper: wrapperFor(client) });

    expect(result.current.rarityColors).toEqual({ ...DEFAULT_RARITY_COLORS, rare: "#123456" });
    expect(result.current.rarityColors.common).toBe("#A6A6A6");
  });

  it("hands every component the same derived object", async () => {
    const client = clientWith();
    const seen: unknown[] = [];
    function Probe() {
      seen.push(useEnumOrders(), useZoneOrder());
      return <span>probe</span>;
    }
    render(
      <QueryClientProvider client={client}>
        <Probe />
        <Probe />
      </QueryClientProvider>,
    );
    await screen.findAllByText("probe");

    expect(seen[2]).toBe(seen[0]);
    expect(seen[3]).toBe(seen[1]);
  });

  it("derives again when the init data changes", () => {
    const client = clientWith();
    const { result, rerender } = renderHook(() => useLanguageList(), {
      wrapper: wrapperFor(client),
    });
    const first = result.current;

    client.setQueryData(
      initKeys.all,
      stubInitResponse({ languages: [{ slug: "DE", label: "German", sortOrder: 0, color: null }] }),
    );
    rerender();

    expect(result.current).not.toBe(first);
    expect(result.current).toEqual([{ code: "DE", name: "German", color: null }]);
  });
});
