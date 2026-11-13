import type { DeckListItemResponse } from "@openrift/shared/types/api/deck";
import { WellKnown } from "@openrift/shared/well-known";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type * as LocalDecks from "@/features/decks/lib/local-decks-collection";

const local = vi.hoisted(() => ({
  updateLocalDeck: vi.fn(),
  duplicateLocalDeck: vi.fn(() => "copy-id"),
}));

vi.mock("@/features/decks/lib/local-decks-collection", async (importOriginal) => ({
  ...(await importOriginal<typeof LocalDecks>()),
  updateLocalDeck: local.updateLocalDeck,
  duplicateLocalDeck: local.duplicateLocalDeck,
}));
vi.mock("@/features/decks/hooks/use-local-decks", () => ({
  useLocalDeck: () => ({ cards: [] }),
  useIsLocalDeck: () => true,
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/hooks/use-enums", () => ({
  useDeckFormatList: () => ({
    formats: [
      { slug: "constructed", label: "Constructed" },
      { slug: "freeform", label: "Freeform" },
    ],
  }),
}));
vi.mock("@/features/cards/hooks/use-cards", () => ({ useCards: () => ({ cardsById: {} }) }));
vi.mock("./deck-export-dialog", () => ({ DeckExportDialog: () => null }));
vi.mock("./deck-print-dialog", () => ({ DeckPrintDialog: () => null }));
vi.mock("./deck-share-dialog", () => ({ DeckShareDialog: () => null }));
vi.mock("./deck-rename-dialog", () => ({ DeckRenameDialog: () => null }));
vi.mock("./deck-variants-dialog", () => ({ DeckVariantsDialog: () => null }));
vi.mock("./manage-deck-folders-dialog", () => ({ ManageDeckFoldersDialog: () => null }));

const { DeckActionsMenu } = await import("./deck-actions-menu");

const ITEM = {
  deck: {
    id: "local-1",
    name: "Teemo Shrooms",
    descriptionSnippet: null,
    description: null,
    links: [],
    oddsConfig: null,
    isPublic: false,
    shareToken: null,
    format: WellKnown.deckFormat.CONSTRUCTED,
    formatConfig: null,
    isPinned: false,
    archivedAt: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    coverCardId: null,
    coverFaceId: null,
    coverPosition: null,
    collectionId: null,
    familyId: null,
    predecessorDeckId: null,
    isPrimary: false,
    isDraft: false,
  },
  legendCardId: null,
  championCardId: null,
  totalCards: 0,
  typeCounts: [],
  domainDistribution: [],
  isValid: true,
  requiredProgress: 0,
  requiredTotal: 0,
  totalValueCents: null,
  unpricedCardCount: null,
  missingCount: null,
  folderIds: [],
  familyName: null,
} satisfies DeckListItemResponse;

function renderMenu() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DeckActionsMenu item={ITEM} source="local" />
    </QueryClientProvider>,
  );
}

describe("DeckActionsMenu on a browser-local deck", () => {
  it("writes the picked format to the local deck", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: "Deck actions" }));
    const changeFormat = await screen.findByRole("menuitem", { name: "Change format" });
    changeFormat.focus();
    await user.keyboard("{ArrowRight}");
    await user.click(await screen.findByRole("menuitem", { name: "Freeform" }));

    expect(local.updateLocalDeck).toHaveBeenCalledWith("local-1", { format: "freeform" });
  });

  it("duplicates the local deck", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: "Deck actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Duplicate" }));

    expect(local.duplicateLocalDeck).toHaveBeenCalledWith("local-1");
  });
});
