import type { CardTradeResponse } from "@openrift/shared/types/api/card-trade";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { buildTradesIndex } from "@/features/groups/lib/trades-index";
import { stubCardTrade, stubPrinting } from "@/test/factories";

const sett = stubPrinting({
  printingId: "p-sett",
  cardId: "c-sett",
  card: { name: "Sett, The Boss" },
});
const jinx = stubPrinting({
  printingId: "p-jinx",
  cardId: "c-jinx",
  card: { name: "Jinx, Rebel" },
});

vi.mock("@/features/cards/hooks/use-cards", () => ({
  useCards: () => ({
    printingsById: { "p-sett": sett, "p-jinx": jinx },
    printingsByCardId: new Map([
      ["c-sett", [sett]],
      ["c-jinx", [jinx]],
    ]),
  }),
}));
vi.mock("@/components/user-avatar", () => ({ UserAvatar: () => null }));
vi.mock("@/features/cards/components/card-art-thumb-stack", () => ({
  CardArtThumbStack: () => null,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/trades">{children}</a>,
}));

const { TradesInProgress } = await import("./trades-in-progress");

function trade(userId: string, name: string, overrides: Partial<CardTradeResponse>) {
  return stubCardTrade({
    id: `${userId}-${overrides.id ?? "t"}`,
    counterparty: { userId, name, image: null, gravatarHash: "h", contactMethods: [] },
    printingId: "p-sett",
    cardId: "c-sett",
    ...overrides,
  });
}

describe("TradesInProgress", () => {
  it("renders nothing without live trades", () => {
    const { container } = render(
      <TradesInProgress index={buildTradesIndex([])} showGroups={false} />,
    );
    expect(container.textContent).toBe("");
  });

  it("orders rows by whose move it is and gives each one action", () => {
    const index = buildTradesIndex([
      trade("u-wait", "Waits", { status: "pending", actionNeeded: "cancel" }),
      trade("u-swap", "Swaps", {
        status: "reserved",
        actionNeeded: "settle",
        role: "giver",
        printingId: "p-jinx",
        cardId: "c-jinx",
      }),
      trade("u-move", "Moves", {
        status: "pending",
        actionNeeded: "accept-or-decline",
        role: "giver",
      }),
    ]);
    render(<TradesInProgress index={index} showGroups={false} />);
    const links = screen.getAllByRole("link").map((link) => link.textContent);
    expect(links).toEqual(["Answer", "Settle up", "Open"]);
    expect(screen.getByText("You give Jinx, Rebel")).toBeTruthy();
    expect(screen.getAllByText("You get Sett, The Boss")).toHaveLength(1);
  });

  it("shows three waiting rows and the rest behind a button", () => {
    const index = buildTradesIndex(
      ["a", "b", "c", "d", "e"].map((id) =>
        trade(`u-${id}`, `Person ${id}`, { status: "pending", actionNeeded: "cancel" }),
      ),
    );
    render(<TradesInProgress index={index} showGroups={false} />);
    expect(screen.getAllByRole("link")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Show 2 more waiting on them" }));
    expect(screen.getAllByRole("link")).toHaveLength(5);
  });

  it("adds the person's other open trades to the meta line and shows their groups", () => {
    const index = buildTradesIndex([
      trade("u-move", "Moves", {
        id: "a",
        status: "pending",
        actionNeeded: "accept-or-decline",
        groupName: "Summoner Skirmish",
      }),
      trade("u-move", "Moves", {
        id: "b",
        status: "pending",
        actionNeeded: "cancel",
        groupName: "Bothfeld Connection",
      }),
    ]);
    render(<TradesInProgress index={index} showGroups />);
    expect(screen.getByText("1 to answer · 1 waiting on them")).toBeTruthy();
    expect(screen.getByText("Bothfeld Connection · Summoner Skirmish")).toBeTruthy();
  });
});
