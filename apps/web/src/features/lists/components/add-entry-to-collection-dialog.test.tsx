import type { CollectionResponse } from "@openrift/shared/types/api/collection";
import type { Printing } from "@openrift/shared/types/catalog";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { stubPrinting } from "@/test/factories";

vi.mock("@/features/cards/components/printing-label", () => ({
  ImportPrintingLabel: ({ printing }: { printing: Printing }) => <span>{printing.id}</span>,
}));

// oxlint-disable-next-line import/first -- must import after vi.mock
const { AddEntriesToCollectionDialogBody, AddEntryToCollectionDialogBody } =
  await import("./add-entry-to-collection-dialog");

const printingA = stubPrinting({ id: "p-a" });
const printingB = stubPrinting({ id: "p-b" });

function stubCollection(overrides: Partial<CollectionResponse>): CollectionResponse {
  return {
    id: "col",
    name: "Collection",
    description: null,
    availableForDeckbuilding: true,
    sidebarHidden: false,
    isInbox: false,
    sortOrder: 0,
    isPublic: false,
    shareToken: null,
    copyCount: 0,
    totalValueCents: null,
    unpricedCopyCount: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    groupId: null,
    groupSlug: null,
    groupName: null,
    viewerCanAdmin: true,
    homeDecks: [],
    ...overrides,
  };
}

const binder = stubCollection({ id: "col-binder", name: "Binder" });
const inbox = stubCollection({ id: "col-inbox", name: "Inbox", isInbox: true });

function renderBody(props: Partial<Parameters<typeof AddEntryToCollectionDialogBody>[0]> = {}) {
  const onConfirm = vi.fn();
  render(
    <Dialog open onOpenChange={() => {}}>
      <DialogContent>
        <AddEntryToCollectionDialogBody
          subject={{
            sourceKind: "printing",
            totalQuantity: 2,
            printing: printingA,
            cardName: "Chaos Rune",
          }}
          collections={[binder, inbox]}
          printings={[printingA]}
          onConfirm={onConfirm}
          onCancel={() => {}}
          isPending={false}
          {...props}
        />
      </DialogContent>
    </Dialog>,
  );
  return { onConfirm };
}

describe("AddEntryToCollectionDialogBody", () => {
  it("adds the entry's quantity to the dropped-on collection", () => {
    const { onConfirm } = renderBody({ fixedCollection: binder });
    expect(screen.getByText('Add to "Binder"')).toBeTruthy();
    expect(screen.getByText(/Creates new owned copies of Chaos Rune/u)).toBeTruthy();
    expect(screen.queryByText("Inbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add copies" }));
    expect(onConfirm).toHaveBeenCalledWith({
      printingId: "p-a",
      collectionId: "col-binder",
      quantity: 2,
    });
  });

  it("preselects the inbox and confirms the picked collection", () => {
    const { onConfirm } = renderBody();
    fireEvent.click(screen.getByRole("button", { name: "Add copies" }));
    expect(onConfirm).toHaveBeenLastCalledWith(
      expect.objectContaining({ collectionId: "col-inbox" }),
    );
    fireEvent.click(screen.getByText("Binder"));
    fireEvent.click(screen.getByRole("button", { name: "Add copies" }));
    expect(onConfirm).toHaveBeenLastCalledWith(
      expect.objectContaining({ collectionId: "col-binder" }),
    );
  });

  it("asks which printing to add for a card entry", () => {
    const { onConfirm } = renderBody({
      fixedCollection: binder,
      subject: {
        sourceKind: "card",
        totalQuantity: 1,
        printing: printingA,
        cardName: "Chaos Rune",
      },
      printings: [printingA, printingB],
    });
    fireEvent.click(screen.getByText("p-b"));
    fireEvent.click(screen.getByRole("button", { name: "Add copies" }));
    expect(onConfirm).toHaveBeenCalledWith({
      printingId: "p-b",
      collectionId: "col-binder",
      quantity: 1,
    });
  });

  it("hides the printing picker for a printing entry", () => {
    renderBody({ printings: [printingA, printingB] });
    expect(screen.queryByText("p-b")).toBeNull();
  });

  it("blocks confirmation when there is no collection", () => {
    const { onConfirm } = renderBody({ collections: [] });
    const button = screen.getByRole("button", { name: "Add copies" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

function renderMultiBody(
  props: Partial<Parameters<typeof AddEntriesToCollectionDialogBody>[0]> = {},
) {
  const onConfirm = vi.fn();
  render(
    <Dialog open onOpenChange={() => {}}>
      <DialogContent>
        <AddEntriesToCollectionDialogBody
          subjects={[
            {
              sourceKind: "printing",
              totalQuantity: 2,
              printing: printingA,
              cardName: "Chaos Rune",
            },
            {
              sourceKind: "printing",
              totalQuantity: 1,
              printing: printingB,
              cardName: "Ionian Blade",
            },
          ]}
          fixedCollection={binder}
          collections={[binder, inbox]}
          printingsByCardId={new Map()}
          printingLabel={(printing) => printing.id}
          onConfirm={onConfirm}
          onCancel={() => {}}
          isPending={false}
          {...props}
        />
      </DialogContent>
    </Dialog>,
  );
  return { onConfirm };
}

describe("AddEntriesToCollectionDialogBody", () => {
  it("adds every selected entry at its own quantity", () => {
    const { onConfirm } = renderMultiBody();
    expect(screen.getByText(/these 2 cards/u)).toBeTruthy();
    expect(screen.getByText("Chaos Rune")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add 3 copies" }));
    expect(onConfirm).toHaveBeenCalledWith({
      collectionId: "col-binder",
      picks: [
        { printingId: "p-a", quantity: 2 },
        { printingId: "p-b", quantity: 1 },
      ],
    });
  });

  it("blocks a selection that would add more copies than one request allows", () => {
    const { onConfirm } = renderMultiBody({
      subjects: [
        {
          sourceKind: "printing",
          totalQuantity: 501,
          printing: printingA,
          cardName: "Chaos Rune",
        },
      ],
    });
    const button = screen.getByRole("button", { name: "Add 501 copies" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("offers a printing per card on a card-kind list", () => {
    const { onConfirm } = renderMultiBody({
      subjects: [
        { sourceKind: "card", totalQuantity: 1, printing: printingA, cardName: "Chaos Rune" },
      ],
      printingsByCardId: new Map([[printingA.cardId, [printingA, printingB]]]),
    });
    expect(screen.getByRole("combobox", { name: "Printing for Chaos Rune" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add 1 copy" }));
    expect(onConfirm).toHaveBeenCalledWith({
      collectionId: "col-binder",
      picks: [{ printingId: "p-a", quantity: 1 }],
    });
  });
});
