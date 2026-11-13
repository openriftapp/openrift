import type { DeckCheckEntryCardResponse } from "@openrift/shared/types/api/deck-check";
import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

const tickMutate = vi.fn();
const removeMutateAsync = vi.fn();

vi.mock("sonner", () => ({ toast: { info: vi.fn() } }));
vi.mock("@/features/tournaments/hooks/use-tournament-deck-check", () => ({
  useTickTournamentDeckCheckCard: () => ({ mutate: tickMutate }),
  useRemoveTournamentDeckCheckCard: () => ({ mutateAsync: removeMutateAsync, isPending: false }),
}));

const { useChecklistCopyActions } = await import("./use-checklist-copy-actions");

const CARD = { id: "card-1", foundCopies: [true, false] } as unknown as DeckCheckEntryCardResponse;

function setup(overrides: { copyIndex?: number; tickLocked?: boolean } = {}) {
  const onStale = vi.fn();
  const { result } = renderHook(() =>
    useChecklistCopyActions({
      tournamentId: "t-1",
      entryId: "e-1",
      card: CARD,
      copyIndex: overrides.copyIndex ?? 1,
      tickLocked: overrides.tickLocked ?? false,
      onStale,
    }),
  );
  return { result, onStale };
}

describe("useChecklistCopyActions", () => {
  beforeEach(() => {
    tickMutate.mockReset();
    removeMutateAsync.mockReset();
    vi.mocked(toast.info).mockClear();
  });

  it("ticks the copy to the opposite of its found state", () => {
    const { result } = setup({ copyIndex: 0 });
    expect(result.current.found).toBe(true);

    act(() => result.current.toggle());

    expect(tickMutate).toHaveBeenCalledWith(
      { tournamentId: "t-1", entryId: "e-1", cardId: "card-1", copyIndex: 0, found: false },
      expect.anything(),
    );
  });

  it("does nothing while ticking is locked", () => {
    const { result } = setup({ tickLocked: true });

    act(() => result.current.toggle());

    expect(tickMutate).not.toHaveBeenCalled();
  });

  it("tells the checker and refreshes when the list changed under the tick", () => {
    const { result, onStale } = setup();
    act(() => result.current.toggle());

    const { onSuccess } = tickMutate.mock.calls[0]![1] as {
      onSuccess: (result: { status: string }) => void;
    };
    onSuccess({ status: "stale" });

    expect(toast.info).toHaveBeenCalledTimes(1);
    expect(onStale).toHaveBeenCalledTimes(1);
  });

  it("closes the remove dialog once the copy is removed", async () => {
    removeMutateAsync.mockResolvedValue(undefined);
    const { result } = setup();
    act(() => result.current.setRemoveOpen(true));

    await act(() => result.current.remove());

    expect(removeMutateAsync).toHaveBeenCalledWith({
      tournamentId: "t-1",
      entryId: "e-1",
      cardId: "card-1",
      copyIndex: 1,
    });
    expect(result.current.removeOpen).toBe(false);
  });

  it("keeps the remove dialog open when the removal fails", async () => {
    removeMutateAsync.mockRejectedValue(new Error("Entry locked"));
    const { result } = setup();
    act(() => result.current.setRemoveOpen(true));

    await act(() => result.current.remove());

    expect(result.current.removeOpen).toBe(true);
  });
});
