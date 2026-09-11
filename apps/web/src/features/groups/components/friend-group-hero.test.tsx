import type { FriendGroupDetailResponse } from "@openrift/shared/types/api/friend-group";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/groups/hooks/use-friend-groups", () => ({
  useFriendGroupActivity: () => ({ data: { events: [] } }),
}));

vi.mock("@/features/cards/hooks/use-cards", () => ({
  useCards: () => ({ printingsById: {} }),
}));

vi.mock("@/features/collections/hooks/use-collections", () => ({
  useCollections: () => ({ data: [] }),
}));

vi.mock("@/features/cards/components/card-fan", () => ({
  CardFan: () => <div data-testid="card-fan" />,
  CardFanOutline: () => <div data-testid="card-fan-outline" />,
}));

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
  }) => {
    let path = to;
    for (const [key, value] of Object.entries(params ?? {})) {
      path = path.replace(`$${key}`, value);
    }
    return (
      <a href={path} className={className}>
        {children}
      </a>
    );
  },
}));

const { FriendGroupHero } = await import("./friend-group-hero");

const BANNER_URL = "/media/group-banners/0199251c-5f1a-7000-8000-00000000000a.webp";

function makeDetail(
  group: Partial<FriendGroupDetailResponse["group"]> = {},
): FriendGroupDetailResponse {
  return {
    group: {
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
      ...group,
    },
    viewerStatus: "member",
    viewerRole: "owner",
    members: [],
    shares: [],
    collectionShares: [],
    pendingRequests: [],
    cardsTradedCount: 0,
    cardsTradedByMember: {},
  };
}

describe("FriendGroupHero", () => {
  it("frames the banner at the stored focus point and drops the card fan", () => {
    const { container } = render(
      <FriendGroupHero
        slug="bothfeld"
        data={makeDetail({ bannerUrl: BANNER_URL, bannerPosition: 20 })}
      />,
    );

    const banner = container.querySelector<HTMLImageElement>(`img[src="${BANNER_URL}"]`);
    expect(banner).not.toBeNull();
    expect(banner?.style.objectPosition).toBe("50% 20%");
    expect(screen.queryByTestId("card-fan")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-fan-outline")).not.toBeInTheDocument();
  });

  it("keeps the card fan when the group has no banner", () => {
    const { container } = render(<FriendGroupHero slug="bothfeld" data={makeDetail()} />);

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByTestId("card-fan-outline")).toBeInTheDocument();
  });

  it("links to the manage page either way", () => {
    render(<FriendGroupHero slug="bothfeld" data={makeDetail({ bannerUrl: BANNER_URL })} />);

    expect(screen.getByRole("link", { name: "Manage" })).toHaveAttribute(
      "href",
      "/groups/bothfeld/manage",
    );
  });
});
