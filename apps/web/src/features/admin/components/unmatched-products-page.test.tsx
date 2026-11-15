import type { StagedProductResponse } from "@openrift/shared/types/api/admin";
import type * as Router from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  set: undefined as string | undefined,
  navigations: [] as unknown[],
  panelSets: [] as (string | undefined)[],
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof Router>()),
  getRouteApi: () => ({
    useSearch: ({ select }: { select: (s: { set?: string }) => unknown }) =>
      select({ set: state.set }),
    useNavigate: () => (options: unknown) => {
      state.navigations.push(options);
      return Promise.resolve();
    },
  }),
  Link: ({ to, children }: { to: string; children?: ReactNode }) => <a href={to}>{children}</a>,
}));

vi.mock("@/components/layout/page-top-bar", () => ({
  PageTopBarBack: () => null,
}));

vi.mock("@/features/admin/components/admin-page-top-bar", () => ({
  AdminPageTopBar: () => null,
}));

vi.mock("@/features/admin/components/unmatched-products-panel", () => ({
  UnmatchedProductsPanel: ({ setSlug }: { setSlug?: string }) => {
    state.panelSets.push(setSlug);
    return null;
  },
}));

vi.mock("@/features/cards/hooks/use-sets", () => ({
  useSets: () => ({ data: { sets: [{ slug: "OGN", name: "Origins" }] } }),
}));

function product(externalId: number, groupSetSlug: string | null) {
  return { externalId, groupSetSlug } as StagedProductResponse;
}

const unmatched = {
  tcgplayer: [product(1, "OGN"), product(2, null)],
  cardmarket: [product(3, null)],
  cardtrader: [],
  cardnexus: [product(4, "SFD")],
};

vi.mock("@/features/admin/hooks/use-unified-mappings", () => ({
  useUnifiedMappings: () => ({ data: { unmatchedProducts: unmatched } }),
}));

const { UnmatchedProductsPage } = await import("./unmatched-products-page");

describe("UnmatchedProductsPage set scope", () => {
  beforeEach(() => {
    state.set = undefined;
    state.navigations = [];
    state.panelSets = [];
  });

  it("shows no scope without a set", () => {
    render(<UnmatchedProductsPage />);

    expect(screen.queryByText(/Set:/u)).toBeNull();
    expect(state.panelSets.at(-1)).toBeUndefined();
  });

  it("names the set, scopes the list and points to products without a set", () => {
    state.set = "OGN";

    render(<UnmatchedProductsPage />);

    expect(screen.getByText("Set: Origins")).toBeTruthy();
    expect(state.panelSets.at(-1)).toBe("OGN");
    expect(screen.getByText(/2 products in marketplace groups without a set are listed/u));
    expect(screen.getByRole("link", { name: "all sets" }).getAttribute("href")).toBe(
      "/admin/unmatched",
    );
  });

  it("clears the set", async () => {
    state.set = "OGN";

    render(<UnmatchedProductsPage />);
    await userEvent.click(screen.getByRole("button", { name: "Show all sets" }));

    expect(state.navigations).toEqual([{ search: {} }]);
  });
});
