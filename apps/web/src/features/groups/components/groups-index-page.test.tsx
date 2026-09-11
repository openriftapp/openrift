import type { FriendGroupSummaryResponse } from "@openrift/shared/types/api/friend-group";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let currentGroups: FriendGroupSummaryResponse[] = [];

vi.mock("@/features/groups/hooks/use-friend-groups", () => ({
  useFriendGroups: () => ({ data: { items: currentGroups, outgoingRequests: [] } }),
  useFriendGroupMatchPanels: () => [],
}));

vi.mock("@/features/groups/hooks/use-card-trades", () => ({
  useTradeActionCounts: () => ({ data: { byGroup: [] } }),
  useUserTrades: () => ({ data: { items: [] } }),
}));

vi.mock("@/features/groups/hooks/use-friend-group-mutations", () => ({
  useCreateFriendGroup: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeclineFriendGroupInvite: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/features/cards/hooks/use-cards", () => ({
  useCards: () => ({ printingsById: {} }),
}));

vi.mock("@/lib/auth-session", () => ({
  useRequiredUserId: () => "viewer-1",
}));

vi.mock("./share-lists-with-group-dialog", () => ({
  ShareListsWithGroupDialog: () => null,
}));

vi.mock("@tanstack/react-router", () => ({
  createLink: (component: unknown) => component,
  useNavigate: () => vi.fn(),
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

const { GroupsIndexPage } = await import("./groups-index-page");

const BANNER_URL = "/media/group-banners/0199251c-5f1a-7000-8000-00000000000a.webp";

function makeSummary(
  overrides: Partial<FriendGroupSummaryResponse> = {},
): FriendGroupSummaryResponse {
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
    viewerRole: "member",
    memberCount: 1,
    pendingRequestCount: 0,
    memberPreviews: [],
    sharedListCount: 0,
    recentTradedCardCount: 0,
    tradedCardCount: 0,
    ...overrides,
  };
}

beforeEach(() => {
  currentGroups = [];
});

describe("GroupsIndexPage", () => {
  it("frames a tile banner at the same focus point the group page uses", () => {
    currentGroups = [makeSummary({ bannerUrl: BANNER_URL, bannerPosition: 20 })];

    const { container } = render(<GroupsIndexPage />);

    const banner = container.querySelector<HTMLImageElement>(`img[src="${BANNER_URL}"]`);
    expect(banner).not.toBeNull();
    expect(banner?.style.objectPosition).toBe("50% 20%");
  });

  it("falls back to a wash strip when the group has no banner", () => {
    currentGroups = [makeSummary()];

    const { container } = render(<GroupsIndexPage />);

    expect(container.querySelector("img")).toBeNull();
    const strip = container.querySelector<HTMLElement>(
      String.raw`[aria-hidden="true"].aspect-\[4\/1\]`,
    );
    expect(strip?.style.backgroundImage).toContain("linear-gradient");
  });
});
