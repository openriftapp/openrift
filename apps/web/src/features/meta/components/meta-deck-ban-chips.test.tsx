import { WellKnown } from "@openrift/shared/well-known";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { MetaBanGroup } from "@/features/meta/lib/meta-deck-bans";

import { MetaDeckBanChips } from "./meta-deck-ban-chips";

const UPCOMING: MetaBanGroup = {
  formatId: WellKnown.banFormat.CONSTRUCTED,
  formatName: "Constructed",
  bannedAt: "2026-11-23",
  inEffect: false,
  cards: [
    { cardId: "c1", displayName: "Zhonya's Hourglass", main: 2, side: 1 },
    { cardId: "c2", displayName: "Stellacorn Herder", main: 3, side: 0 },
  ],
};

const IN_EFFECT: MetaBanGroup = {
  formatId: WellKnown.banFormat.CONSTRUCTED,
  formatName: "Constructed",
  bannedAt: "2026-09-18",
  inEffect: true,
  cards: [{ cardId: "c3", displayName: "Ekko, Recurrent", main: 2, side: 0 }],
};

const MODE_ONLY: MetaBanGroup = {
  formatId: "2v2",
  formatName: "2v2",
  bannedAt: "2026-09-18",
  inEffect: true,
  cards: [{ cardId: "c4", displayName: "Twin Strike", main: 1, side: 0 }],
};

function trigger(): HTMLElement {
  return screen.getByRole("button", { name: /ban/iu });
}

describe("MetaDeckBanChips", () => {
  it("renders nothing for a list without banned cards", () => {
    const { container } = render(<MetaDeckBanChips groups={[]} eventDate="2026-11-06" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("names the date a ban takes effect", () => {
    render(<MetaDeckBanChips groups={[UPCOMING]} eventDate="2026-11-06" />);

    expect(trigger()).toHaveTextContent("Ban Nov 23");
  });

  it("shows both chips when one ban is in effect and another follows", () => {
    render(<MetaDeckBanChips groups={[IN_EFFECT, UPCOMING]} eventDate="2025-06-01" />);

    expect(trigger()).toHaveTextContent("Banned");
    expect(trigger()).toHaveTextContent("Ban Nov 23");
  });

  it("names the mode when the only ban in effect is scoped to it", () => {
    render(<MetaDeckBanChips groups={[MODE_ONLY]} eventDate="2025-06-01" />);

    expect(trigger()).toHaveTextContent("2v2 Ban");
  });

  it("names the mode of an upcoming ban scoped to one mode", () => {
    render(
      <MetaDeckBanChips
        groups={[{ ...MODE_ONLY, bannedAt: "2026-12-01", inEffect: false }]}
        eventDate="2026-11-06"
      />,
    );

    expect(trigger()).toHaveTextContent("2v2 ban Dec 1");
  });

  it("says a list with only a mode ban stays legal elsewhere", async () => {
    render(<MetaDeckBanChips groups={[MODE_ONLY]} eventDate="2025-06-01" />);

    await userEvent.click(trigger());

    expect(await screen.findByText("Legal in other constructed play.")).toBeInTheDocument();
  });

  it("lists the affected cards and says the list was legal when played", async () => {
    render(<MetaDeckBanChips groups={[UPCOMING]} eventDate="2026-11-06" />);

    await userEvent.click(trigger());

    expect(await screen.findByText("Banned in Constructed from Nov 23, 2026")).toBeInTheDocument();
    expect(screen.getByText("Zhonya's Hourglass")).toBeInTheDocument();
    expect(screen.getByText("1 in sideboard")).toBeInTheDocument();
    expect(screen.getByText("Legal when this list was played on Nov 6, 2026.")).toBeInTheDocument();
  });

  it("drops the legal-when-played line when a ban predates the event", async () => {
    render(<MetaDeckBanChips groups={[IN_EFFECT]} eventDate="2026-10-01" />);

    await userEvent.click(trigger());

    expect(await screen.findByText("Banned in Constructed since Sep 18, 2026")).toBeInTheDocument();
    expect(screen.queryByText(/Legal when this list was played/u)).toBeNull();
  });
});
