import type { CardTradeResponse } from "@openrift/shared/types/api/card-trade";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTradeTallyStore } from "@/features/groups/stores/trade-tally-store";
import { createStoreResetter } from "@/test/store-helpers";

const TRADE = {
  id: "trade-1",
  cardId: "card-1",
  printingId: "printing-1",
  quantity: 2,
  role: "giver",
  groupSlug: "bothfeld",
} as CardTradeResponse;

const mocks = vi.hoisted(() => ({
  syncFails: false,
}));

vi.mock("@/features/groups/hooks/use-card-trades", () => ({
  tradeCopyOptionsQueryOptions: () => ({ queryKey: ["copy-options"], queryFn: () => null }),
  useApplyTradeSync: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
    mutate: (
      _variables: unknown,
      options: { onSuccess?: () => void; onError?: () => void; onSettled?: () => void },
    ) => {
      if (mocks.syncFails) {
        options.onError?.();
      } else {
        options.onSuccess?.();
      }
      options.onSettled?.();
    },
  }),
}));
vi.mock("@/features/groups/lib/trade-settle-batch", () => ({
  runSettleBatch: async () => ({
    settledTradeIds: [],
    failed: false,
    pendingChoices: [
      {
        trade: TRADE,
        quantity: 2,
        options: { tradeId: "trade-1", quantity: 2, choiceMatters: true, copies: [] },
      },
    ],
  }),
}));
vi.mock("@/features/groups/components/trade-copy-picker-dialog", () => ({
  TradeSettleCopyPickerDialog: ({ flow }: { flow: { confirm: (copyIds: string[]) => void } }) => (
    <button type="button" onClick={() => flow.confirm(["copy-a", "copy-b"])}>
      Confirm copies
    </button>
  ),
}));
vi.mock("@/features/groups/hooks/use-trade-add-target", () => ({
  useTradeAddTarget: () => ({ collectionId: "col-1", label: "Inbox" }),
}));
vi.mock("@/features/groups/components/trade-add-target-dialog", () => ({
  TradeAddTargetDialog: () => null,
}));
vi.mock("@/features/groups/components/trade-row", () => ({ TradeRow: () => null }));
vi.mock("@/features/groups/components/trade-row-parts", () => ({
  CardMetaLine: () => null,
  TradeDirectionIcon: () => null,
  TradeEstimatedPrice: () => null,
}));
vi.mock("@/features/cards/components/card-art-thumb", () => ({ CardArtThumb: () => null }));
vi.mock("@/features/cards/components/card-detail-opener", () => ({
  CardDetailNameButton: () => null,
}));
vi.mock("@/features/cards/hooks/use-cards", () => ({
  useCards: () => ({ cardsById: {}, printingsById: {}, printingsByCardId: new Map() }),
}));
vi.mock("@/hooks/use-session", () => ({ useRequiredUserId: () => "user-1" }));

const { TradeSettleSection } = await import("./trade-settle-section");

let resetTally: () => void;

beforeEach(() => {
  resetTally = createStoreResetter(useTradeTallyStore);
  mocks.syncFails = false;
});

afterEach(() => {
  resetTally();
});

async function openCopyChoice() {
  useTradeTallyStore.getState().setCount("trade-1", 1);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TradeSettleSection trades={[TRADE]} />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Resume" }));
  fireEvent.click(screen.getByRole("button", { name: "Settle 1 card" }));
  return screen.findByRole("button", { name: "Confirm copies" });
}

describe("TradeSettleSection copy choice", () => {
  it("keeps the choice and the tally when the sync fails", async () => {
    mocks.syncFails = true;
    fireEvent.click(await openCopyChoice());

    expect(screen.getByRole("button", { name: "Confirm copies" })).toBeInTheDocument();
    expect(useTradeTallyStore.getState().counts["trade-1"]).toBe(1);
  });

  it("clears the tally and closes the choice when the sync succeeds", async () => {
    fireEvent.click(await openCopyChoice());

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Confirm copies" })).not.toBeInTheDocument(),
    );
    expect(useTradeTallyStore.getState().counts["trade-1"]).toBeUndefined();
  });
});
