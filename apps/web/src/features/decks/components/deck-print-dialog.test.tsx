import type * as ReactQuery from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as ShareImage from "@/lib/share-image";
import { stubDeckBuilderCard } from "@/test/factories";

const { fetchImageBlobMock, fetchImageBlobFromPostMock, downloadImageAsPdfMock } = vi.hoisted(
  () => ({
    fetchImageBlobMock: vi.fn(),
    fetchImageBlobFromPostMock: vi.fn(),
    downloadImageAsPdfMock: vi.fn(),
  }),
);

vi.mock("@/lib/share-image", async (importOriginal) => ({
  ...(await importOriginal<typeof ShareImage>()),
  fetchImageBlob: fetchImageBlobMock,
  fetchImageBlobFromPost: fetchImageBlobFromPostMock,
}));

vi.mock("@/lib/image-pdf", () => ({ downloadImageAsPdf: downloadImageAsPdfMock }));

vi.mock("@/lib/site-config", () => ({ getSiteUrl: () => "https://openrift.app" }));

vi.mock("@/features/decks/hooks/use-deck-builder", () => ({ useDeckCards: () => [] }));

vi.mock("@/hooks/use-session", () => ({ useSession: () => ({ data: undefined }) }));

// Only the client read is stubbed; the module graph pulls a real QueryClient through the server cache.
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactQuery>()),
  useQueryClient: () => ({}),
}));

import { DeckSheetPrintPanel } from "./deck-print-dialog";

const cards = [stubDeckBuilderCard({ cardId: "card-1", cardName: "Yasuo", quantity: 3 })];

describe("DeckSheetPrintPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchImageBlobMock.mockResolvedValue(new Blob());
    fetchImageBlobFromPostMock.mockResolvedValue(new Blob());
  });

  it("renders a public deck's sheet through the share token, not the owner route", async () => {
    render(
      <DeckSheetPrintPanel
        deckId="deck-1"
        deckName="Yasuo Aggro"
        cards={cards}
        publicSource={{ shareToken: "tok123", imageVersion: 42 }}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Download PDF" }));

    expect(fetchImageBlobMock).toHaveBeenCalledWith(
      "https://openrift.app/api/v1/decks/share/tok123/image.png?v=42-r2&size=hq",
    );
    expect(fetchImageBlobFromPostMock).not.toHaveBeenCalled();
  });

  it("drops the scan code from a public deck's sheet when the viewer unticks it", async () => {
    render(
      <DeckSheetPrintPanel
        deckId="deck-1"
        deckName="Yasuo Aggro"
        cards={cards}
        publicSource={{ shareToken: "tok123", imageVersion: 42 }}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox", { name: /scan code/iu }));
    await user.click(screen.getByRole("button", { name: "Download PDF" }));

    expect(fetchImageBlobMock).toHaveBeenCalledWith(
      "https://openrift.app/api/v1/decks/share/tok123/image.png?v=42-r2&size=hq&qr=0",
    );
  });

  it("keeps a deck the viewer owns on the owner route", async () => {
    render(<DeckSheetPrintPanel deckId="deck-1" deckName="Yasuo Aggro" cards={cards} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Download PDF" }));

    expect(fetchImageBlobMock).toHaveBeenCalledWith(
      "https://openrift.app/api/v1/decks/deck-1/image.png?size=hq&qr=0",
    );
    expect(downloadImageAsPdfMock).toHaveBeenCalledWith(expect.any(Blob), "yasuo-aggro-sheet.pdf");
  });

  it("hides the scan code option for an owned deck that is not shared", async () => {
    render(<DeckSheetPrintPanel deckId="deck-1" deckName="Yasuo Aggro" cards={cards} />);

    expect(screen.queryByRole("checkbox", { name: /scan code/iu })).toBeNull();
  });

  it("offers the scan code for an owned deck that is shared", async () => {
    render(<DeckSheetPrintPanel deckId="deck-1" deckName="Yasuo Aggro" cards={cards} isShared />);
    const user = userEvent.setup();
    expect(screen.getByRole("checkbox", { name: /scan code/iu })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Download PDF" }));

    expect(fetchImageBlobMock).toHaveBeenCalledWith(
      "https://openrift.app/api/v1/decks/deck-1/image.png?size=hq",
    );
  });
});
