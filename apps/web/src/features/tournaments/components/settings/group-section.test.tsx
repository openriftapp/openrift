import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

const updateMutateAsync = vi.fn();

vi.mock("@/features/tournaments/hooks/use-tournament-mutations", () => ({
  useUpdateTournament: () => ({ mutateAsync: updateMutateAsync, isPending: false }),
}));

vi.mock("@/features/groups/hooks/use-friend-groups", () => ({
  useFriendGroups: () => ({ data: { items: [{ id: "group-1", name: "Zaun Thursdays" }] } }),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { GroupSection } = await import("./group-section");

function makeDetail(overrides: Partial<TournamentDetailResponse> = {}): TournamentDetailResponse {
  return {
    id: "tournament-1",
    name: "Summoner Skirmish",
    groupId: "group-1",
    groupName: "Zaun Thursdays",
    published: true,
    ...overrides,
  } as unknown as TournamentDetailResponse;
}

beforeEach(() => {
  updateMutateAsync.mockClear();
  updateMutateAsync.mockResolvedValue(undefined);
  vi.mocked(toast.success).mockClear();
});

describe("GroupSection publish switch", () => {
  it("is absent when no group is linked", () => {
    render(<GroupSection detail={makeDetail({ groupId: null, groupName: null })} locked={false} />);

    expect(
      screen.queryByRole("switch", { name: "Published to the group" }),
    ).not.toBeInTheDocument();
  });

  it("hides a published tournament from the group", async () => {
    const user = userEvent.setup();
    render(<GroupSection detail={makeDetail()} locked={false} />);

    await user.click(screen.getByRole("switch", { name: "Published to the group" }));

    expect(updateMutateAsync).toHaveBeenCalledWith({ id: "tournament-1", published: false });
    expect(toast.success).toHaveBeenCalledWith("Hidden from the group");
  });

  it("publishes an unpublished tournament", async () => {
    const user = userEvent.setup();
    render(<GroupSection detail={makeDetail({ published: false })} locked={false} />);

    await user.click(screen.getByRole("switch", { name: "Published to the group" }));

    expect(updateMutateAsync).toHaveBeenCalledWith({ id: "tournament-1", published: true });
  });

  it("ignores clicks while settings are locked", async () => {
    const user = userEvent.setup();
    render(<GroupSection detail={makeDetail()} locked />);

    await user.click(screen.getByRole("switch", { name: "Published to the group" }));

    expect(updateMutateAsync).not.toHaveBeenCalled();
  });
});
