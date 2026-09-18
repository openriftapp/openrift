import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryDeckLinkMock } = vi.hoisted(() => ({ queryDeckLinkMock: vi.fn() }));

vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({}) }));

vi.mock("@/features/cards/hooks/use-cards", () => ({ useCards: () => ({ allPrintings: [] }) }));

vi.mock("@/features/decks/lib/deck-compare-side", () => ({
  compareLinkParam: (kind: string, token: string) => `${kind}:${token}`,
  queryDeckLink: queryDeckLinkMock,
}));

// oxlint-disable-next-line import/first -- must import after vi.mock
import { DeckComparePasteDialog } from "./deck-compare-paste-dialog";

function renderDialog() {
  const onResolved = vi.fn();
  const onLinked = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <DeckComparePasteDialog
      open
      onOpenChange={onOpenChange}
      onResolved={onResolved}
      onLinked={onLinked}
    />,
  );
  return { onResolved, onLinked, onOpenChange };
}

async function paste(text: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("textbox"));
  await user.paste(text);
  await user.click(screen.getByRole("button", { name: "Use this list" }));
}

describe("DeckComparePasteDialog", () => {
  beforeEach(() => {
    queryDeckLinkMock.mockReset();
  });

  it("turns a meta deck link into a linkable side", async () => {
    queryDeckLinkMock.mockResolvedValue({ cards: [{ cardId: "card-1" }] });
    const { onLinked, onResolved, onOpenChange } = renderDialog();

    await paste("https://openrift.app/meta/decks/eFHFCGDrFNr4");

    expect(queryDeckLinkMock).toHaveBeenCalledWith({}, "meta", "eFHFCGDrFNr4");
    expect(onLinked).toHaveBeenCalledWith("meta:eFHFCGDrFNr4");
    expect(onResolved).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("turns a share link into a linkable side", async () => {
    queryDeckLinkMock.mockResolvedValue({ cards: [{ cardId: "card-1" }] });
    const { onLinked } = renderDialog();

    await paste("https://openrift.app/decks/share/Abc123Xyz456");

    expect(onLinked).toHaveBeenCalledWith("share:Abc123Xyz456");
  });

  it("keeps the dialog open when the linked deck has no cards", async () => {
    queryDeckLinkMock.mockResolvedValue({ cards: [] });
    const { onLinked, onOpenChange } = renderDialog();

    await paste("https://openrift.app/meta/decks/eFHFCGDrFNr4");

    expect(
      await screen.findByText("That shared deck has no cards to compare against."),
    ).toBeTruthy();
    expect(onLinked).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("keeps the dialog open when the linked deck fails to load", async () => {
    queryDeckLinkMock.mockRejectedValue(new Error("NOT_FOUND"));
    const { onLinked } = renderDialog();

    await paste("https://openrift.app/meta/decks/eFHFCGDrFNr4");

    expect(
      await screen.findByText("Couldn't load that shared deck. The link may have been unshared."),
    ).toBeTruthy();
    expect(onLinked).not.toHaveBeenCalled();
  });
});
