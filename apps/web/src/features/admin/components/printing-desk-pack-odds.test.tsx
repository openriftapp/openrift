// @vitest-environment jsdom
import type { DeskPrintingRow } from "@openrift/shared/contracts/admin/printing-desk";
import type { Printing } from "@openrift/shared/types/catalog";
import type * as ReactQuery from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { stubPrinting } from "@/test/factories";

const SET_ID = "set-ogn";

function originsPrintings(): Printing[] {
  const base = { setSlug: "OGN", language: "EN", size: "standard" as const };
  return [
    stubPrinting({ ...base, printingId: "common", rarity: "common", finish: "normal" }),
    stubPrinting({ ...base, printingId: "uncommon", rarity: "uncommon", finish: "normal" }),
    stubPrinting({ ...base, printingId: "foil", rarity: "common", finish: "foil" }),
    stubPrinting({ ...base, printingId: "rare", rarity: "rare", finish: "foil" }),
    stubPrinting({
      ...base,
      printingId: "rune",
      rarity: "common",
      finish: "normal",
      card: { types: ["rune"] },
    }),
  ];
}

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactQuery>()),
  useQuery: () => ({ data: { printings: originsPrintings() } }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/features/cards/hooks/use-sets", () => ({
  useSets: () => ({ data: { sets: [{ id: SET_ID, slug: "OGN", name: "Origins" }] } }),
}));

vi.mock("@/features/admin/hooks/use-distribution-channels", () => ({
  useDistributionChannels: () => ({
    data: {
      distributionChannels: [
        { id: "b", slug: "booster", parentId: null },
        { id: "n", slug: "nexus-night", parentId: null },
      ],
    },
  }),
}));

vi.mock("@/components/ui/info-hint", () => ({
  InfoHint: () => null,
}));

import { PrintingDeskPackOdds } from "./printing-desk-pack-odds";

const existing = {
  printingId: "rare",
  setId: SET_ID,
  setSlug: "OGN",
  setName: "Origins",
  side: 1,
} as DeskPrintingRow;

const draft = {
  setId: SET_ID,
  language: "EN",
  size: "standard",
  finish: "foil",
  markerSlugs: [],
  channelSlugs: [],
};

describe("PrintingDeskPackOdds", () => {
  it("lists the printing's slots once when the draft keeps them", () => {
    render(<PrintingDeskPackOdds existing={existing} draft={draft} />);
    expect(screen.queryByText("After saving")).toBeNull();
    expect(screen.getAllByText("Origins Booster Pack")).toHaveLength(2);
  });

  it("warns when a channel takes the printing out of every pack", () => {
    render(
      <PrintingDeskPackOdds
        existing={existing}
        draft={{ ...draft, channelSlugs: ["nexus-night"] }}
      />,
    );
    expect(screen.getByText("After saving")).toBeTruthy();
    expect(screen.getByText(/takes this printing out of every booster pack/u)).toBeTruthy();
  });
});
