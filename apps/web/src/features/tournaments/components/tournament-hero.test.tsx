import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  createLink: (component: unknown) => component,
  Link: ({
    to,
    params,
    children,
    className,
  }: {
    to: string;
    params?: Record<string, string>;
    children?: ReactNode;
    className?: string;
  }) => (
    <a
      href={Object.entries(params ?? {}).reduce(
        (path, [key, value]) => path.replace(`$${key}`, value),
        to,
      )}
      className={className}
    >
      {children}
    </a>
  ),
}));

vi.mock("@/features/tournaments/components/hero-avatar-cluster", () => ({
  HeroAvatarCluster: () => null,
}));

const { TournamentHero } = await import("./tournament-hero");

function makeDetail(overrides: Partial<TournamentDetailResponse> = {}): TournamentDetailResponse {
  return {
    id: "t-1",
    name: "Summoner Skirmish",
    startsAt: "2099-06-01T10:00:00.000Z",
    endsAt: null,
    status: "scheduled",
    playMode: "1v1",
    pairingStyle: "swiss",
    format: "rounds",
    currentRound: 0,
    deckSubmission: "none",
    selfRegistration: false,
    host: {
      type: "organization",
      userId: null,
      orgId: "org-1",
      orgSlug: null,
      displayName: "Hextech Hall",
    },
    groupSlug: "bandle-city",
    groupName: null,
    uvsgamesEventId: null,
    metaEventSlug: null,
    participantPreview: [],
    participantCount: 0,
    ...overrides,
  } as unknown as TournamentDetailResponse;
}

describe("TournamentHero", () => {
  it("links the host organization by id even without a slug", () => {
    render(<TournamentHero detail={makeDetail()} />);

    expect(screen.getByRole("link", { name: "Hextech Hall" })).toHaveAttribute(
      "href",
      "/organizations/org-1",
    );
  });

  it("never shows the raw group slug when the group has no name", () => {
    render(<TournamentHero detail={makeDetail()} />);

    expect(screen.queryByText("bandle-city")).not.toBeInTheDocument();
  });

  it("names a group-cut event and never says Live", () => {
    render(
      <TournamentHero
        detail={makeDetail({
          format: "group_cut",
          startsAt: "2020-06-01T10:00:00.000Z",
          endsAt: "2099-06-01T10:00:00.000Z",
          status: "running",
        } as Partial<TournamentDetailResponse>)}
      />,
    );

    expect(screen.getByText("Group stage and cut tournament")).toBeInTheDocument();
    expect(screen.queryByText(/Live/u)).not.toBeInTheDocument();
  });
});
