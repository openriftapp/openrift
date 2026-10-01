import type { EffectiveTradePreference } from "@openrift/shared/types/api/trade-preferences";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let cardtraderPrice: number | undefined = 11.39;

vi.mock("@/features/cards/hooks/use-prices", () => ({
  usePrices: () => ({
    get: (_printingId: string, marketplace: string) =>
      marketplace === "cardtrader" ? cardtraderPrice : 10.2,
  }),
}));

const { MatchPreferenceText } = await import("./match-preference-cell");

function pref(overrides: Partial<EffectiveTradePreference>): EffectiveTradePreference {
  return {
    pricePref: null,
    priceAbsoluteCents: null,
    tradeType: null,
    currency: "EUR",
    ...overrides,
  };
}

function renderText(value: EffectiveTradePreference) {
  return render(
    <MatchPreferenceText
      pref={value}
      printingId="p-teemo"
      marketplaceInfos={null}
      searchQuery="Teemo, Scout"
    />,
  );
}

describe("MatchPreferenceText", () => {
  it("quotes CardTrader's current price and links to it", () => {
    cardtraderPrice = 11.39;
    renderText(pref({ pricePref: "ct_zero", tradeType: "cards" }));
    expect(screen.getByRole("link", { name: "€11.39 at CardTrader" })).toBeTruthy();
    expect(screen.getByText(/Cards/u)).toBeTruthy();
  });

  it("names the CardTrader price when there is no figure", () => {
    cardtraderPrice = undefined;
    renderText(pref({ pricePref: "ct_zero" }));
    expect(screen.getByRole("link", { name: "CardTrader price" })).toBeTruthy();
  });

  it("names the Cardmarket and TCGplayer price without quoting a figure", () => {
    const { unmount } = renderText(pref({ pricePref: "cm_lowest" }));
    expect(screen.getByRole("link", { name: "Cardmarket price" })).toBeTruthy();
    expect(screen.queryByText(/10\.20/u)).toBeNull();
    unmount();
    renderText(pref({ pricePref: "tcg_lowest" }));
    expect(screen.getByRole("link", { name: "TCGplayer price" })).toBeTruthy();
  });

  it("shows a fixed price as the amount", () => {
    renderText(pref({ pricePref: "absolute", priceAbsoluteCents: 3100 }));
    expect(screen.getByText("€31.00")).toBeTruthy();
  });
});
