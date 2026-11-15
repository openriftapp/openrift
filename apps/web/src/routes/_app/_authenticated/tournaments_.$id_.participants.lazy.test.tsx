import type {
  TournamentDetailResponse,
  TournamentViewerRole,
} from "@openrift/shared/types/api/tournament";
import { render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const viewer = vi.hoisted(() => ({
  myRoles: [] as TournamentViewerRole[],
  status: "setup" as TournamentDetailResponse["status"],
}));

vi.mock("@tanstack/react-router", () => ({
  createLazyFileRoute: () => (options: { component: ComponentType }) => ({
    options,
    useParams: () => ({ id: "t-1" }),
  }),
}));

vi.mock("@/features/tournaments/hooks/use-tournaments", () => ({
  useTournamentDetail: () => ({ data: { myRoles: viewer.myRoles, status: viewer.status } }),
}));

vi.mock("@/features/tournaments/components/tournament-detail-frame", () => ({
  TournamentSectionFrame: ({ actions }: { actions?: ReactNode }) => <div>{actions}</div>,
}));

vi.mock("@/features/tournaments/components/tournament-participants-tab", () => ({
  AddParticipantButton: () => <span>Add player</span>,
  TournamentParticipantsTab: () => null,
}));

const { Route } = await import("./tournaments_.$id_.participants.lazy");
const Page = (Route as unknown as { options: { component: ComponentType } }).options.component;

describe("tournament participants page", () => {
  it.each<[TournamentViewerRole[], boolean]>([
    [["host"], true],
    [["organizer"], true],
    [["judge"], true],
    [["participant"], false],
  ])("offers adding a player to %s: %s", (myRoles, shown) => {
    viewer.myRoles = myRoles;
    viewer.status = "setup";
    render(<Page />);
    expect(screen.queryByText("Add player") !== null).toBe(shown);
  });

  it("hides adding a player from staff once the event is completed", () => {
    viewer.myRoles = ["host"];
    viewer.status = "completed";
    render(<Page />);
    expect(screen.queryByText("Add player")).toBeNull();
  });
});
