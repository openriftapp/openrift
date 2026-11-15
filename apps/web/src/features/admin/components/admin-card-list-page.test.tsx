import type * as Router from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  set: undefined as string | undefined,
  summaryCalls: [] as { enabled: boolean; set?: string }[],
  isPlaceholderData: false,
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof Router>()),
  getRouteApi: () => ({
    useSearch: ({ select }: { select: (s: { set?: string }) => unknown }) =>
      select({ set: state.set }),
  }),
  Link: ({
    to,
    search,
    children,
  }: {
    to: string;
    search?: Record<string, string | undefined>;
    children?: ReactNode;
  }) => {
    const query = new URLSearchParams(
      Object.entries(search ?? {}).filter(
        (entry): entry is [string, string] => entry[1] !== undefined,
      ),
    ).toString();
    return <a href={query ? `${to}?${query}` : to}>{children}</a>;
  },
}));

vi.mock("@/features/admin/components/admin-page-top-bar", () => ({
  AdminPageTopBar: ({ actions }: { actions?: ReactNode }) => <div>{actions}</div>,
}));

vi.mock("@/features/admin/components/admin-cards-table", () => ({
  ALL_SETS: "__all__",
  AdminCardsTable: () => null,
}));

vi.mock("@/features/admin/hooks/use-admin", () => ({
  useAdminAccess: () => ({ data: { isAdmin: true } }),
}));

vi.mock("@/features/admin/hooks/use-admin-card-queries", () => ({
  useAdminCardList: () => ({ data: [] }),
}));

vi.mock("@/features/cards/hooks/use-sets", () => ({
  useSets: () => ({ data: { sets: [] } }),
}));

vi.mock("@/features/admin/hooks/use-unified-mappings", () => ({
  useUnifiedMappingsSummaryWhen: (enabled: boolean, set?: string) => {
    state.summaryCalls.push({ enabled, set });
    return {
      data: { assignBucketsBySlug: new Map(), unmatchedCount: set ? 2 : 9, unattributedCount: 5 },
      isPlaceholderData: state.isPlaceholderData,
    };
  },
}));

const { AdminCardListPage } = await import("./admin-card-list-page");

describe("AdminCardListPage unmatched link", () => {
  beforeEach(() => {
    state.set = undefined;
    state.summaryCalls = [];
    state.isPlaceholderData = false;
  });

  it("shows the global count and links to the unscoped page without a set filter", () => {
    render(<AdminCardListPage />);

    const link = screen.getByRole("link", { name: /Unmatched 9/u });
    expect(link.getAttribute("href")).toBe("/admin/unmatched");
    expect(state.summaryCalls.at(-1)).toEqual({ enabled: true, set: undefined });
  });

  it("asks for the set's count and carries the set to the unmatched page", () => {
    state.set = "OGN";

    render(<AdminCardListPage />);

    const link = screen.getByRole("link", { name: /Unmatched 2/u });
    expect(link.getAttribute("href")).toBe("/admin/unmatched?set=OGN");
    expect(state.summaryCalls.at(-1)).toEqual({ enabled: true, set: "OGN" });
  });

  it("shows no number while the count is still the previous set's", () => {
    state.set = "SFD";
    state.isPlaceholderData = true;

    render(<AdminCardListPage />);

    expect(screen.getByRole("link", { name: /Unmatched …/u })).toBeTruthy();
    expect(screen.queryByText(/Unmatched 2/u)).toBeNull();
  });

  it("says how many products sit in groups without a set when a set is selected", () => {
    state.set = "OGN";

    render(<AdminCardListPage />);

    expect(screen.getByText("5 products in marketplace groups without a set")).toBeTruthy();
  });

  it("leaves the note out without a set", () => {
    render(<AdminCardListPage />);

    expect(screen.queryByText(/without a set/u)).toBeNull();
  });
});
