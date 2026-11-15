import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { save } = vi.hoisted(() => ({ save: vi.fn<(vars: unknown) => Promise<void>>() }));

vi.mock("@/features/decks/hooks/use-decks", async () => {
  const { useMutation } = await import("@tanstack/react-query");
  return {
    useUpdateDeck: (meta?: Record<string, unknown>) => useMutation({ mutationFn: save, meta }),
  };
});

vi.mock("@/features/collections/hooks/use-collections", () => ({
  useCollectionsList: () => [
    { id: "col-1", name: "Piltover binder", groupId: null, homeDecks: [] },
    { id: "col-2", name: "Zaun box", groupId: null, homeDecks: [] },
  ],
}));

vi.mock("@/features/collections/components/create-collection-dialog", () => ({
  CreateCollectionDialog: () => null,
}));

const { DeckHomeCollectionDialog } = await import("./deck-home-collection-dialog");

function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <DeckHomeCollectionDialog
      deckId="deck-1"
      currentCollectionId="col-1"
      open={open}
      onOpenChange={setOpen}
    />
  );
}

async function moveToZaunBox() {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Harness />
    </QueryClientProvider>,
  );
  await user.click(screen.getByRole("combobox", { name: "Collection" }));
  await user.click(await screen.findByRole("option", { name: "Zaun box" }));
  await user.click(screen.getByRole("button", { name: "Save" }));
}

describe("DeckHomeCollectionDialog", () => {
  beforeEach(() => {
    save.mockReset();
  });

  it("stays open until the save resolves, then closes", async () => {
    let finish: (() => void) | undefined;
    save.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    await moveToZaunBox();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    finish?.();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(save.mock.calls[0]?.[0]).toEqual({ deckId: "deck-1", collectionId: "col-2" });
  });

  it("stays open with the pick and an inline error when the save fails", async () => {
    save.mockRejectedValue(new TypeError("Failed to fetch"));
    await moveToZaunBox();
    expect(
      await screen.findByText("Can't reach the server. Check your connection."),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Collection" })).toHaveTextContent("Zaun box");
  });
});
