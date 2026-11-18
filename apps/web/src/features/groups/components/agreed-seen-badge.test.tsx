import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { stubCardTrade } from "@/test/factories";

import { AgreedSeenBadge } from "./trade-status-badge";

const AGREED = {
  status: "reserved",
  initiator: "giver",
  autoAccepted: true,
} as const;

describe("AgreedSeenBadge", () => {
  it("marks a trade as new for the member whose setting accepted it", () => {
    render(<AgreedSeenBadge trade={stubCardTrade({ ...AGREED, role: "receiver" })} />);
    expect(screen.getByText("New, agreed automatically")).toBeInTheDocument();
  });

  it("tells the sender when the other member has not looked yet", () => {
    render(<AgreedSeenBadge trade={stubCardTrade({ ...AGREED, role: "giver" })} />);
    expect(screen.getByText(/^Not seen by .+ yet$/u)).toBeInTheDocument();
  });

  it("tells the sender once the other member has looked", () => {
    render(
      <AgreedSeenBadge
        trade={stubCardTrade({
          ...AGREED,
          role: "giver",
          recipientSeenAt: "2026-11-18T10:00:00.000Z",
        })}
      />,
    );
    expect(screen.getByText(/^Seen by /u)).toBeInTheDocument();
  });

  it("renders nothing for a trade that was answered by hand", () => {
    const { container } = render(
      <AgreedSeenBadge
        trade={stubCardTrade({ ...AGREED, role: "receiver", autoAccepted: false })}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
