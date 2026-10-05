import type { DeckPlanResponse } from "@openrift/shared/types/api/deck";
import { WellKnown } from "@openrift/shared/well-known";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DeckPlanEditor } from "./deck-plan-editor";

const SAVED_PLAN: DeckPlanResponse = {
  generalStrategy: "",
  mulliganSplit: false,
  mulliganGeneral: "",
  mulliganFirst: "",
  mulliganSecond: "",
  battlefieldGame1CardId: null,
  battlefieldFirstCardId: null,
  battlefieldSecondCardId: null,
  battlefieldCustom: false,
  battlefieldNote: "",
  matchups: [],
};

vi.mock("@/features/decks/hooks/use-deck-plan", () => ({
  useDeckPlan: () => ({ data: { plan: SAVED_PLAN } }),
  useSaveDeckPlan: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
}));
vi.mock("@/features/cards/hooks/use-cards", () => ({
  useCards: () => ({ allPrintings: [] }),
}));
vi.mock("@/features/cards/hooks/use-preferred-printing", () => ({
  usePreferredPrinting: () => ({ getPreferredPrinting: () => undefined }),
}));
vi.mock("@/hooks/use-session", () => ({
  useRequiredUserId: () => "user-1",
}));
vi.mock("@/components/unsaved-changes-guard", () => ({
  UnsavedChangesGuard: ({ onLeave }: { onLeave?: () => void }) => (
    <button type="button" onClick={onLeave}>
      Leave without saving
    </button>
  ),
}));

function renderEditor(queryClient: QueryClient, deckId = "deck-1") {
  return render(
    <QueryClientProvider client={queryClient}>
      <DeckPlanEditor deckId={deckId} deckCards={[]} format={WellKnown.deckFormat.CONSTRUCTED} />
    </QueryClientProvider>,
  );
}

function strategyField() {
  return screen.getByLabelText("General strategy");
}

describe("DeckPlanEditor", () => {
  it("restores an unsaved plan after the tab is closed and reopened", () => {
    const queryClient = new QueryClient();
    const first = renderEditor(queryClient);
    fireEvent.change(strategyField(), { target: { value: "Pressure early" } });
    first.unmount();

    renderEditor(queryClient);

    expect(strategyField()).toHaveValue("Pressure early");
  });

  it("starts from the saved plan once the draft matches it again", () => {
    const queryClient = new QueryClient();
    const first = renderEditor(queryClient);
    fireEvent.change(strategyField(), { target: { value: "Pressure early" } });
    fireEvent.change(strategyField(), { target: { value: "" } });
    first.unmount();

    renderEditor(queryClient);

    expect(strategyField()).toHaveValue("");
  });

  it("discards the stored draft when leaving without saving", () => {
    const queryClient = new QueryClient();
    const first = renderEditor(queryClient);
    fireEvent.change(strategyField(), { target: { value: "Pressure early" } });
    fireEvent.click(screen.getByRole("button", { name: "Leave without saving" }));
    first.unmount();

    renderEditor(queryClient);

    expect(strategyField()).toHaveValue("");
  });

  it("keeps each deck's plan to itself", () => {
    const queryClient = new QueryClient();
    const first = renderEditor(queryClient, "deck-1");
    fireEvent.change(strategyField(), { target: { value: "Pressure early" } });
    first.unmount();

    renderEditor(queryClient, "deck-2");

    expect(strategyField()).toHaveValue("");
  });
});
