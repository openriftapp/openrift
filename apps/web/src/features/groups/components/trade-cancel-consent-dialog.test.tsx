import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TradeCancelConsentDialog } from "@/features/groups/components/trade-cancel-consent-dialog";
import { useTradeCancelConsentStore } from "@/features/groups/stores/trade-cancel-consent-store";

function trade(index: number, counterpartyName: string | null = "Mara") {
  return {
    id: `trade-${index}`,
    cardId: `card-${index}`,
    printingId: `printing-${index}`,
    quantity: 2,
    counterpartyName,
  };
}

describe("TradeCancelConsentDialog", () => {
  const answer = vi.fn();

  beforeEach(() => {
    answer.mockReset();
    useTradeCancelConsentStore.setState({ answer });
  });

  it("names the count, the cards and who each trade is with", () => {
    render(
      <TradeCancelConsentDialog
        trades={[trade(1), trade(2, null)]}
        cardName={(t) => (t.cardId === "card-1" ? "Jinx, Rebel" : "Ahri, Alluring")}
      />,
    );

    expect(screen.getByText("Cancel 2 pending trades?")).toBeInTheDocument();
    expect(screen.getByText("2× Jinx, Rebel for Mara")).toBeInTheDocument();
    expect(screen.getByText("2× Ahri, Alluring for Member")).toBeInTheDocument();
  });

  it("lists five trades and counts the rest", () => {
    render(
      <TradeCancelConsentDialog
        trades={[1, 2, 3, 4, 5, 6, 7].map((index) => trade(index))}
        cardName={() => "Jinx, Rebel"}
      />,
    );

    expect(screen.getAllByText("2× Jinx, Rebel for Mara")).toHaveLength(5);
    expect(screen.getByText("and 2 more")).toBeInTheDocument();
  });

  it("confirms with Cancel trades", async () => {
    render(<TradeCancelConsentDialog trades={[trade(1)]} cardName={() => "Jinx, Rebel"} />);

    await userEvent.click(screen.getByRole("button", { name: "Cancel trades" }));

    expect(answer).toHaveBeenCalledWith(true);
  });

  it("declines with Keep trades", async () => {
    render(<TradeCancelConsentDialog trades={[trade(1)]} cardName={() => "Jinx, Rebel"} />);

    await userEvent.click(screen.getByRole("button", { name: "Keep trades" }));

    expect(answer).toHaveBeenCalledWith(false);
  });
});
