import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listDetailQueryOptions, listsQueryOptions } from "@/features/lists/lib/lists-queries";

import { QueueSourcePicker } from "./queue-source-picker";

const mdUp = vi.hoisted(() => ({ value: true }));

vi.mock("@/hooks/use-is-mobile", () => ({ useIsMobile: () => !mdUp.value }));
vi.mock("@/hooks/use-session", () => ({ useUserId: () => "user-1" }));
vi.mock("@/hooks/use-sign-in-search", () => ({ useSignInSearch: () => ({ to: "/login" }) }));
vi.mock("@/features/cards/hooks/use-cards", () => ({
  useCards: () => ({ printingsById: new Map(), printingsByCardId: new Map() }),
}));
vi.mock("@/features/decks/hooks/use-decks", () => ({ useDeckList: () => [] }));
vi.mock("@/features/stage/lib/present-queue-sources", () => ({
  deckPrintingIds: () => [],
  listPrintingIds: () => ["printing-1"],
}));

function renderPicker(onAdd = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(listsQueryOptions("user-1").queryKey, {
    items: [{ id: "list-1", name: "Trade binder", intent: "trade" }],
  } as never);
  client.setQueryData(listDetailQueryOptions("user-1", "list-1").queryKey, {
    entries: [],
  } as never);
  render(
    <QueryClientProvider client={client}>
      <QueueSourcePicker onAdd={onAdd} />
    </QueryClientProvider>,
  );
  return onAdd;
}

describe("QueueSourcePicker", () => {
  beforeEach(() => {
    mdUp.value = true;
  });

  it.each([true, false])("fills the queue from a picked list (md up: %s)", async (up) => {
    mdUp.value = up;
    const user = userEvent.setup();
    const onAdd = renderPicker();

    await user.click(screen.getByRole("button", { name: "a list" }));
    expect(document.querySelector("[data-slot=drawer-popup]") !== null).toBe(!up);
    await user.click(await screen.findByRole("option", { name: /Trade binder/u }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith({ label: "Trade binder", printingIds: ["printing-1"] });
    });
  });
});
