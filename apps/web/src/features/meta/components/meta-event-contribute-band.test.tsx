import type { MetaEventDetail } from "@openrift/shared/types/api/meta";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { metaEvent } from "@/test/meta-event-fixtures";

const session = vi.hoisted(() => ({ userId: null as string | null }));

vi.mock("@/lib/auth-session", () => ({ useUserId: () => session.userId }));

vi.mock("@tanstack/react-router", async () => {
  const fixtures = await import("@/test/meta-event-fixtures");
  return { Link: fixtures.StubLink };
});

const { MetaEventContributeBand } = await import("./meta-event-contribute-band");

function renderBand(
  field: { entries: number; withLists: number } = { entries: 1, withLists: 0 },
  overrides: Partial<MetaEventDetail> = {},
) {
  return render(
    <MetaEventContributeBand
      event={metaEvent(overrides)}
      entries={field.entries}
      withLists={field.withLists}
      slug="summoner-skirmish"
    />,
  );
}

describe("MetaEventContributeBand", () => {
  beforeEach(() => {
    session.userId = null;
  });

  it("stands down for an event with no standings to complete", () => {
    const { container } = renderBand({ entries: 0, withLists: 0 });
    expect(container).toBeEmptyDOMElement();
  });

  it("asks by the event's name, not the street address it was played at", () => {
    renderBand(
      { entries: 1, withLists: 0 },
      {
        location: "Av. de la Reina Maria Cristina, s/n, Sants-Montjuïc, 08004 Barcelona, Spain",
      },
    );
    expect(screen.getByText("Were you at Summoner Skirmish?")).toBeInTheDocument();
  });

  it("counts the whole field, not the page of standings on screen", () => {
    renderBand({ entries: 3000, withLists: 40 });
    expect(
      screen.getByText(
        "2,960 of 3,000 entries are still missing their decklist. Contributors are credited on every event.",
      ),
    ).toBeInTheDocument();
  });

  it("still welcomes corrections once every entry has its list", () => {
    renderBand({ entries: 1, withLists: 1 });
    expect(
      screen.getByText("Every entry has its decklist. Corrections are still welcome."),
    ).toBeInTheDocument();
  });

  it("sends a signed-in reader to this event's form", () => {
    session.userId = "user-1";
    renderBand();
    expect(screen.getByRole("link", { name: "Add a decklist" })).toHaveAttribute(
      "href",
      "/meta/summoner-skirmish/submit",
    );
  });

  it("tells a signed-out reader that signing in is what stands in the way", () => {
    renderBand();
    expect(screen.getByRole("link", { name: "Sign in to add a decklist" })).toHaveAttribute(
      "href",
      "/login?redirect=%2Fmeta%2Fsummoner-skirmish%2Fsubmit",
    );
  });
});
