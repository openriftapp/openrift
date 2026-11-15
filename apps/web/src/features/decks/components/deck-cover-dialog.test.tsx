import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { save } = vi.hoisted(() => ({ save: vi.fn<(patch: unknown) => Promise<void>>() }));

vi.mock("@/features/decks/hooks/use-decks", async () => {
  const { useMutation } = await import("@tanstack/react-query");
  return {
    useUpdateDeckMeta: (_deckId: string, meta?: Record<string, unknown>) => {
      const mutation = useMutation({ mutationFn: save, meta });
      return {
        update: vi.fn(),
        save: mutation.mutateAsync,
        isPending: mutation.isPending,
        isError: mutation.isError,
        error: mutation.error,
      };
    },
  };
});

const { DeckCoverDialog } = await import("./deck-cover-dialog");

function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <DeckCoverDialog
      deckId="deck-1"
      open={open}
      onOpenChange={setOpen}
      cards={[]}
      coverCardId="card-1"
      coverFaceId={null}
      coverPosition={40}
      getThumbnail={() => undefined}
      getCoverThumbnail={() => undefined}
      faceOf={() => null}
    />
  );
}

async function resetToLegendDefault() {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Harness />
    </QueryClientProvider>,
  );
  await user.click(screen.getByRole("button", { pressed: false }));
  await user.click(screen.getByRole("button", { name: "Save" }));
}

describe("DeckCoverDialog", () => {
  beforeEach(() => {
    save.mockReset();
  });

  it("closes once the cover is saved", async () => {
    save.mockResolvedValue();
    await resetToLegendDefault();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(save.mock.calls[0]?.[0]).toEqual({
      coverCardId: null,
      coverFaceId: null,
      coverPosition: null,
    });
  });

  it("stays open with the pick and an inline error when the save fails", async () => {
    save.mockRejectedValue(new TypeError("Failed to fetch"));
    await resetToLegendDefault();
    expect(
      await screen.findByText("Can't reach the server. Check your connection."),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { pressed: true })).toBeInTheDocument();
  });
});
