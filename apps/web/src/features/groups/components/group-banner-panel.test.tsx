import type { FriendGroupResponse } from "@openrift/shared/types/api/friend-group";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const uploadMutate = vi.fn();
const removeMutate = vi.fn();
const updateMutate = vi.fn();

vi.mock("@/features/groups/hooks/use-friend-group-mutations", () => ({
  useRemoveFriendGroupBanner: () => ({ mutate: removeMutate, isPending: false }),
  useUpdateFriendGroup: () => ({ mutate: updateMutate, isPending: false }),
}));

vi.mock("@/features/groups/hooks/use-upload-group-banner", () => ({
  useUploadGroupBanner: () => ({ mutate: uploadMutate, isPending: false }),
}));

// jsdom has no pointer capture or layout boxes, so the real Base UI slider
// can't produce a drag; this stub exposes its value callback directly.
vi.mock("@/components/ui/slider", () => ({
  Slider: ({ onValueChange }: { onValueChange?: (value: number[]) => void }) => (
    <button type="button" onClick={() => onValueChange?.([30])}>
      move-focus
    </button>
  ),
}));

const { GroupBannerPanel } = await import("./group-banner-panel");

const BANNER_URL = "/media/group-banners/0199251c-5f1a-7000-8000-00000000000a.webp";

function makeGroup(overrides: Partial<FriendGroupResponse> = {}): FriendGroupResponse {
  return {
    id: "group-1",
    slug: "bothfeld",
    name: "Bothfeld Connection",
    description: null,
    bannerUrl: null,
    bannerPosition: 50,
    code: null,
    codeRotatedAt: "2026-01-01T00:00:00Z",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GroupBannerPanel", () => {
  it("offers only the upload when the group has no banner", () => {
    render(<GroupBannerPanel group={makeGroup()} />);

    expect(screen.getByLabelText("Add a banner")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove banner" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "move-focus" })).not.toBeInTheDocument();
  });

  it("uploads the chosen file for the group", async () => {
    const user = userEvent.setup();
    render(<GroupBannerPanel group={makeGroup()} />);
    const file = new File([new Uint8Array(8)], "banner.jpg", { type: "image/jpeg" });

    await user.upload(screen.getByLabelText("Add a banner"), file);

    expect(uploadMutate).toHaveBeenCalledWith(
      { slug: "bothfeld", file },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
  });

  it("shows the current banner at its stored focus", () => {
    render(<GroupBannerPanel group={makeGroup({ bannerUrl: BANNER_URL, bannerPosition: 20 })} />);

    const image = screen.getByAltText("Group banner");
    expect(image).toHaveAttribute("src", BANNER_URL);
    expect(image).toHaveStyle({ objectPosition: "50% 20%" });
  });

  it("saves a focus the admin moved, and not one they did not", async () => {
    const user = userEvent.setup();
    render(<GroupBannerPanel group={makeGroup({ bannerUrl: BANNER_URL, bannerPosition: 20 })} />);

    const save = screen.getByRole("button", { name: "Save focus" });
    expect(save).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "move-focus" }));
    await user.click(save);

    expect(updateMutate).toHaveBeenCalledWith({ slug: "bothfeld", bannerPosition: 30 });
  });

  it("removes the banner", async () => {
    const user = userEvent.setup();
    render(<GroupBannerPanel group={makeGroup({ bannerUrl: BANNER_URL })} />);

    await user.click(screen.getByRole("button", { name: "Remove banner" }));

    expect(removeMutate).toHaveBeenCalledWith("bothfeld");
  });
});
