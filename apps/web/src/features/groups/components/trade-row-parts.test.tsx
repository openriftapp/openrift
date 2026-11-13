import type { CardTradeResponse } from "@openrift/shared/types/api/card-trade";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LiveTradesElsewhereLine, tradeBadgeState } from "./trade-row-parts";

function trade(overrides: Partial<CardTradeResponse>): CardTradeResponse {
  return {
    id: "trade-1",
    groupId: "group-1",
    groupSlug: "rift-crew",
    groupName: "Rift Crew",
    role: "receiver",
    initiator: "receiver",
    counterparty: {
      userId: "user-2",
      name: "Robin",
      image: null,
      gravatarHash: "hash",
      contactMethods: [],
    },
    printingId: "printing-1",
    cardId: "card-1",
    quantity: 1,
    status: "pending",
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-01T10:00:00.000Z",
    acceptedAt: null,
    completedAt: null,
    closedAt: null,
    expiresAt: null,
    viewerSyncAppliedAt: null,
    counterpartySyncAppliedAt: null,
    viewerWishEntryId: null,
    actionNeeded: null,
    ...overrides,
  };
}

describe("LiveTradesElsewhereLine", () => {
  it("names a request the viewer sent", () => {
    render(<LiveTradesElsewhereLine trades={[trade({})]} />);
    expect(screen.getByText("You already asked Robin for 1, still pending")).toBeTruthy();
  });

  it("names an offer the other member sent as theirs", () => {
    render(<LiveTradesElsewhereLine trades={[trade({ initiator: "giver" })]} />);
    expect(screen.getByText("Robin offered you 1, waiting for your answer")).toBeTruthy();
  });

  it("names an accepted request the other member sent", () => {
    render(
      <LiveTradesElsewhereLine
        trades={[trade({ role: "giver", initiator: "receiver", status: "reserved" })]}
      />,
    );
    expect(screen.getByText("You accepted Robin's request for 1")).toBeTruthy();
  });

  it("renders nothing without trades", () => {
    const { container } = render(<LiveTradesElsewhereLine trades={[]} />);
    expect(container.textContent).toBe("");
  });
});

describe("tradeBadgeState", () => {
  it("splits a pending trade by whose move it is", () => {
    expect(tradeBadgeState({ status: "pending", awaitingViewer: true })).toBe("your-move");
    expect(tradeBadgeState({ status: "pending", awaitingViewer: false })).toBe("waiting-for-them");
  });

  it("treats an unqualified pending trade as waiting on them", () => {
    expect(tradeBadgeState({ status: "pending" })).toBe("waiting-for-them");
  });

  it("splits a reserved trade by whether the viewer has settled their half", () => {
    expect(tradeBadgeState({ status: "reserved" })).toBe("ready-to-swap");
    expect(tradeBadgeState({ status: "reserved", viewerSettled: true })).toBe("done-your-side");
  });

  it("keeps each terminal status distinct, so no section can suppress them as one", () => {
    expect(tradeBadgeState({ status: "completed" })).toBe("status:completed");
    expect(tradeBadgeState({ status: "declined" })).toBe("status:declined");
    expect(tradeBadgeState({ status: "cancelled" })).toBe("status:cancelled");
    expect(tradeBadgeState({ status: "expired" })).toBe("status:expired");
  });

  it("does not let a settle-awaiting legacy completed row take the ready-to-swap state", () => {
    expect(tradeBadgeState({ status: "completed", viewerSettled: false })).not.toBe(
      "ready-to-swap",
    );
  });
});
