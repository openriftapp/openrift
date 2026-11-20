import type { PublicDeckCardResponse } from "@openrift/shared/types/api/deck";
import type { CardType } from "@openrift/shared/types/enums";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { encodeMock, dialogProps } = vi.hoisted(() => ({
  encodeMock: vi.fn(),
  dialogProps: new Map<string, Record<string, unknown>>(),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({
    to,
    search,
    children,
    ...rest
  }: {
    to: string;
    search: { from: string };
    children?: React.ReactNode;
  }) => (
    <a href={`${to}?from=${search.from}`} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/features/decks/hooks/use-decks", () => ({
  useEncodeDeckCards: () => ({ mutate: vi.fn(), mutateAsync: encodeMock, isPending: false }),
  useExportDeck: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/use-copy-to-clipboard", () => ({
  copyPendingText: () => Promise.resolve(true),
}));

vi.mock("@/lib/site-config", () => ({ getSiteUrl: () => "https://openrift.app" }));

vi.mock("@/components/layout/page-top-bar", () => ({
  PageTopBarIconButton: (props: Record<string, unknown>) => (
    <button type="button" data-in-top-bar {...props} />
  ),
}));

vi.mock("@/components/share/share-dialog", () => ({
  ShareDialog: (props: Record<string, unknown>) => {
    dialogProps.set("link", props);
    return null;
  },
}));

vi.mock("@/features/decks/components/deck-share-dialog", () => ({
  DeckImageDialog: (props: Record<string, unknown>) => {
    dialogProps.set("image", props);
    return null;
  },
}));

vi.mock("@/features/decks/components/deck-print-dialog", () => ({
  DeckPrintDialog: (props: Record<string, unknown>) => {
    dialogProps.set("print", props);
    return null;
  },
}));

import { PublicDeckActionsMenu } from "./public-deck-actions-menu";

function publicCard(overrides: Partial<PublicDeckCardResponse> = {}): PublicDeckCardResponse {
  return {
    cardId: "card-1",
    zone: "main",
    quantity: 3,
    preferredPrintingId: null,
    cardName: "Yasuo",
    cardSlug: "yasuo",
    cardType: "unit" as CardType,
    cardTypes: ["unit" as CardType],
    superTypes: [],
    domains: [],
    tags: [],
    keywords: [],
    maxCopiesOverride: null,
    additionalLegendCount: null,
    banned: false,
    energy: 2,
    might: 3,
    power: 1,
    resolvedPrintingId: null,
    shortCode: null,
    imageId: null,
    ...overrides,
  };
}

function renderMenu(props: Partial<React.ComponentProps<typeof PublicDeckActionsMenu>> = {}) {
  return render(
    <PublicDeckActionsMenu
      deckId="deck-1"
      deckName="Yasuo Aggro"
      shareToken="tok123"
      linkKind="share"
      updatedAt="2026-09-01T00:00:00.000Z"
      cards={[publicCard()]}
      {...props}
    />,
  );
}

async function openMenu(): Promise<ReturnType<typeof userEvent.setup>> {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Deck actions" }));
  await screen.findByRole("menuitem", { name: "Deck code" });
  return user;
}

const IMAGE_VERSION = new Date("2026-09-01T00:00:00.000Z").getTime();

describe("PublicDeckActionsMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dialogProps.clear();
    encodeMock.mockResolvedValue({ code: "DECKCODE", warnings: [] });
  });

  it("offers the public actions and nothing that needs an account", async () => {
    renderMenu();
    await openMenu();

    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Play on RiftAtlas",
      "Compare with another deck…",
      "Link & QR…",
      "Save image…PNG, A4 PDF",
      "Text list",
      "Deck code",
      "Tabletop Simulator codes",
      "Proxies…",
      "Registration sheet…",
    ]);
    expect(screen.queryByText(/delete/iu)).toBeNull();
    expect(screen.queryByText("Manage")).toBeNull();
  });

  it("opens the comparison with a shared deck as the left side", async () => {
    renderMenu();
    await openMenu();

    expect(screen.getByRole("menuitem", { name: "Compare with another deck…" })).toHaveAttribute(
      "href",
      "/decks/compare?from=share:tok123",
    );
  });

  it("opens the comparison with a meta deck as the left side", async () => {
    renderMenu({ linkKind: "meta" });
    await openMenu();

    expect(screen.getByRole("menuitem", { name: "Compare with another deck…" })).toHaveAttribute(
      "href",
      "/decks/compare?from=meta:tok123",
    );
  });

  it("encodes the deck's own cards in the picked format", async () => {
    renderMenu();
    const user = await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Text list" }));

    expect(encodeMock).toHaveBeenCalledWith({
      format: "text",
      cards: [expect.objectContaining({ cardId: "card-1", quantity: 3, zone: "main" })],
    });
  });

  it("links the meta deck's own page", async () => {
    renderMenu({ linkKind: "meta" });
    const user = await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Link & QR…" }));

    const link = dialogProps.get("link")?.link as { url: string } | undefined;
    expect(link?.url).toBe("https://openrift.app/meta/decks/tok123");
  });

  it("links the shared deck's own page", async () => {
    renderMenu();
    const user = await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Link & QR…" }));

    const link = dialogProps.get("link")?.link as { url: string } | undefined;
    expect(link?.url).toBe("https://openrift.app/decks/share/tok123");
  });

  it("renders the image off the share token", async () => {
    renderMenu();
    const user = await openMenu();
    await user.click(screen.getByRole("menuitem", { name: /Save image…/u }));

    expect(dialogProps.get("image")?.publicSource).toEqual({
      shareToken: "tok123",
      imageVersion: IMAGE_VERSION,
    });
  });

  it("hands the print dialog the deck's cards and the picked sheet", async () => {
    renderMenu();
    const user = await openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Registration sheet…" }));

    expect(dialogProps.get("print")?.kind).toBe("registration");
    expect(dialogProps.get("print")?.cards).toEqual([
      expect.objectContaining({ cardId: "card-1", quantity: 3 }),
    ]);
  });

  it("renders the trigger as a top-bar button when the page has a bar", async () => {
    renderMenu({ inTopBar: true });

    expect(screen.getByRole("button", { name: "Deck actions" })).toHaveAttribute("data-in-top-bar");
    await openMenu();
  });
});
