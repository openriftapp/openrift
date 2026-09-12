import type { CopyResponse } from "@openrift/shared/types/api/collection";
import type { ListEntryDetailResponse, ListKind } from "@openrift/shared/types/api/list";
import type { Printing } from "@openrift/shared/types/catalog";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EMPTY_TRADE_PREFERENCE, stubCopy, stubPrinting } from "@/test/factories";

const viPrinting = stubPrinting({ id: "p-vi", cardId: "card-vi", card: { name: "Vi" } });
const jinxPrinting = stubPrinting({ id: "p-jinx", cardId: "card-jinx", card: { name: "Jinx" } });

vi.mock("@/lib/auth-session", () => ({
  useRequiredUserId: () => "user-1",
}));

vi.mock("@/features/cards/hooks/use-cards", () => ({
  useCards: () => ({
    printingsById: { [viPrinting.id]: viPrinting, [jinxPrinting.id]: jinxPrinting },
    sets: [{ id: viPrinting.setId, setType: "main" }],
  }),
}));

vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({
    labels: { rarities: {}, conditions: {}, graders: {} },
  }),
}));

let filtered: { hasActiveFilters: boolean; filteredEntries: ListEntryDetailResponse[] } = {
  hasActiveFilters: false,
  filteredEntries: [],
};

vi.mock("@/features/lists/hooks/use-filtered-list-entries", () => ({
  useFilteredListEntries: () => filtered,
}));

let copies: CopyResponse[] = [];

vi.mock("@/features/collections/hooks/use-copies", () => ({
  useCopies: () => ({ data: copies, isReady: true }),
}));

const toastSuccess = vi.fn();
vi.mock("sonner", () => ({ toast: { success: (...args: unknown[]) => toastSuccess(...args) } }));

const { ListExportDialog } = await import("./list-export-dialog");

const baseEntry = {
  listId: "list-1",
  ruleQuantity: 0,
  source: "manual",
  quantity: 1,
  tradeOverride: EMPTY_TRADE_PREFERENCE,
} as const;

function cardEntry(id: string, cardId: string, cardName: string): ListEntryDetailResponse {
  return { ...baseEntry, id, kind: "card", cardId, cardName };
}

function printingFields(printing: Printing) {
  return {
    printingId: printing.id,
    cardName: printing.card.name,
    setId: printing.setId,
    rarity: printing.rarity,
    finish: printing.finish,
    shortCode: printing.shortCode,
    language: printing.language,
    imageId: null,
  };
}

function printingEntry(id: string, printing: Printing): ListEntryDetailResponse {
  return { ...baseEntry, id, kind: "printing", ...printingFields(printing) };
}

function copyEntry(id: string, copyId: string, printing: Printing): ListEntryDetailResponse {
  return {
    ...baseEntry,
    id,
    kind: "copy",
    copyId,
    ...printingFields(printing),
    reserved: false,
    onLoan: false,
  };
}

const viEntry = cardEntry("e-1", "card-vi", "Vi");
const jinxEntry = cardEntry("e-2", "card-jinx", "Jinx");

let downloadedBlobs: Blob[] = [];

function setup(entries: ListEntryDetailResponse[], kind: ListKind = "card") {
  render(
    <ListExportDialog
      listName="Piltover picks"
      kind={kind}
      entries={entries}
      open
      onOpenChange={vi.fn()}
    />,
  );
}

const exportText = () => (screen.getAllByRole("textbox")[0] as HTMLTextAreaElement).value;

describe("ListExportDialog", () => {
  beforeEach(() => {
    filtered = { hasActiveFilters: false, filteredEntries: [] };
    copies = [];
    toastSuccess.mockReset();
    downloadedBlobs = [];
    vi.stubGlobal(
      "URL",
      Object.assign(globalThis.URL, {
        createObjectURL: vi.fn((blob: Blob) => {
          downloadedBlobs.push(blob);
          return "blob:fake";
        }),
        revokeObjectURL: vi.fn(),
      }),
    );
  });

  it("exports the whole list and offers no filter toggle when no filters are active", () => {
    setup([viEntry, jinxEntry]);

    expect(screen.queryByRole("checkbox", { name: /current filters/u })).not.toBeInTheDocument();
    expect(exportText()).toBe("1 Vi\n1 Jinx");
  });

  it("defaults to the filtered subset when filters are active", () => {
    filtered = { hasActiveFilters: true, filteredEntries: [jinxEntry] };
    setup([viEntry, jinxEntry]);

    expect(
      screen.getByRole("checkbox", { name: "Only cards matching the current filters (1 of 2)" }),
    ).toBeChecked();
    expect(exportText()).toBe("1 Jinx");
  });

  it("falls back to the whole list when the filter scope is unchecked", async () => {
    const user = userEvent.setup();
    filtered = { hasActiveFilters: true, filteredEntries: [jinxEntry] };
    setup([viEntry, jinxEntry]);

    await user.click(
      screen.getByRole("checkbox", { name: "Only cards matching the current filters (1 of 2)" }),
    );

    expect(exportText()).toBe("1 Vi\n1 Jinx");
  });

  it("scopes the Cardmarket wants block to the filtered subset too", () => {
    filtered = { hasActiveFilters: true, filteredEntries: [jinxEntry] };
    setup([viEntry, jinxEntry]);

    const wants = screen.getAllByRole("textbox")[1] as HTMLTextAreaElement;
    expect(wants.value).toBe("1x Jinx");
  });

  it("offers only the text format for a card list", () => {
    setup([viEntry, jinxEntry]);

    expect(screen.queryByText("OpenRift CSV")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /export \d/iu })).not.toBeInTheDocument();
  });

  it("counts the CSV download against the filtered subset", () => {
    const entries = [printingEntry("e-1", viPrinting), printingEntry("e-2", jinxPrinting)];
    filtered = { hasActiveFilters: true, filteredEntries: [entries[1]!] };
    setup(entries, "printing");

    expect(screen.getByRole("button", { name: "Export 1 card" })).toBeInTheDocument();
  });

  it("offers a text list for a printing list too", async () => {
    const user = userEvent.setup();
    setup([printingEntry("e-1", viPrinting), printingEntry("e-2", jinxPrinting)], "printing");

    await user.click(screen.getByText("OpenRift CSV"));
    await user.click(await screen.findByRole("option", { name: "Text list" }));

    expect(exportText()).toBe("1 Vi\n1 Jinx");
  });

  it("writes copy metadata into a copy list's CSV", async () => {
    const user = userEvent.setup();
    copies = [
      stubCopy({ id: "copy-1", printingId: viPrinting.id, condition: "near-mint" }),
      stubCopy({ id: "copy-2", printingId: jinxPrinting.id, condition: "played" }),
    ];
    setup(
      [copyEntry("e-1", "copy-1", viPrinting), copyEntry("e-2", "copy-2", jinxPrinting)],
      "copy",
    );

    await user.click(screen.getByRole("button", { name: "Export 2 cards" }));

    expect(toastSuccess).toHaveBeenCalledWith("List exported.");
    const csv = await downloadedBlobs[0]!.text();
    expect(csv).toContain("near-mint");
    expect(csv).toContain("played");
  });
});
