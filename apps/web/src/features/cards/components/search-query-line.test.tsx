import type { SearchVocabulary } from "@openrift/shared/search-query/bind";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SearchAlternative } from "@/features/cards/lib/search-alternative";

const { mockUseFilterValues, mockUseFilterActions } = vi.hoisted(() => ({
  mockUseFilterValues: vi.fn(),
  mockUseFilterActions: vi.fn(),
}));

vi.mock("@/features/cards/hooks/use-card-filters", () => ({
  useFilterValues: mockUseFilterValues,
  useFilterActions: mockUseFilterActions,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to: _to,
    search,
    children,
    ...props
  }: React.ComponentProps<"a"> & { to?: string; search: (prev: object) => { q: string } }) => (
    <a {...props} href={`?q=${search({}).q}`}>
      {children}
    </a>
  ),
}));

import { SearchQueryLine } from "./search-query-line";

const ALTERNATIVES: SearchAlternative[] = [
  { kind: "text", query: "o:noxus", label: "noxus", count: 1 },
  { kind: "tag", query: "tag:noxus", label: "Noxus", count: 61 },
];

function setup({
  search,
  showTerms = true,
  filteredCount = 12,
  alternatives,
  vocabulary = {},
}: {
  search: string;
  showTerms?: boolean;
  filteredCount?: number;
  alternatives?: SearchAlternative[];
  vocabulary?: SearchVocabulary;
}) {
  const actions = { setSearch: vi.fn() };
  mockUseFilterValues.mockReturnValue({ filterState: { search } });
  mockUseFilterActions.mockReturnValue(actions);
  const { container } = render(
    <SearchQueryLine
      filteredCount={filteredCount}
      showTerms={showTerms}
      vocabulary={vocabulary}
      valueLabel={(_key, value) => value}
      alternatives={alternatives}
    />,
  );
  return { actions, container };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("SearchQueryLine term chips", () => {
  it("describes each keyed clause in plain words", () => {
    setup({ search: "t:unit e<=3 -kw:shield" });

    expect(screen.getByText("type contains “unit”")).toBeInTheDocument();
    expect(screen.getByText("energy ≤ 3")).toBeInTheDocument();
    expect(screen.getByText("not keyword contains “shield”")).toBeInTheDocument();
  });

  it("keeps an or group in one chip", () => {
    setup({ search: "(d:calm or d:mind) -(t:spell or fire)" });

    expect(screen.getByText("domain: calm or domain: mind")).toBeInTheDocument();
    expect(screen.getByText("not (type contains “spell” or “fire”)")).toBeInTheDocument();
  });

  it("removes one term from the applied query through its chip", async () => {
    const user = userEvent.setup();
    const { actions } = setup({ search: "jinx (d:calm or d:mind) e<=3" });

    await user.click(
      screen.getByRole("button", { name: "Remove (d:calm or d:mind) from the search" }),
    );

    expect(actions.setSearch).toHaveBeenCalledWith("jinx e<=3");
  });

  it("renders nothing for a plain-word query without alternatives", () => {
    const { container } = setup({ search: "teemo" });

    expect(container).toBeEmptyDOMElement();
  });

  it("flags an unknown key and a malformed value", () => {
    setup({ search: "foo:bar e<=x" });

    expect(screen.getByText("Unknown key “foo:”, ignored")).toBeInTheDocument();
    expect(screen.getByText("“x” doesn't work with e:")).toBeInTheDocument();
  });

  it("names the key to use for a key from another search tool", () => {
    setup({ search: "cost:3 t:unit" });

    expect(screen.getByText("Unknown key “cost:”, ignored. Use e: here")).toBeInTheDocument();
  });

  it("warns about a value outside the vocabulary", () => {
    setup({ search: "d:purple", filteredCount: 0, vocabulary: { domain: ["fury"] } });

    expect(screen.getByText("No domain called “purple”, ignored")).toBeInTheDocument();
  });

  it("leaves the chips to the active-filters strip when terms are off", () => {
    const { container } = setup({ search: "t:unit", showTerms: false });

    expect(container).toBeEmptyDOMElement();
  });
});

describe("SearchQueryLine search alternatives", () => {
  it("links to the card text and tag searches", () => {
    setup({ search: "noxus", alternatives: ALTERNATIVES });

    expect(screen.getByRole("link", { name: "1 card has “noxus” in its text" })).toHaveAttribute(
      "href",
      "?q=o:noxus",
    );
    expect(screen.getByRole("link", { name: "61 cards tagged “Noxus”" })).toHaveAttribute(
      "href",
      "?q=tag:noxus",
    );
  });

  it("shows the alternatives when the term chips are off", () => {
    setup({ search: "noxus", alternatives: ALTERNATIVES, showTerms: false });

    expect(screen.getByRole("link", { name: "61 cards tagged “Noxus”" })).toBeInTheDocument();
  });

  it("leaves an empty result to the empty state", () => {
    const { container } = setup({ search: "noxus", alternatives: ALTERNATIVES, filteredCount: 0 });

    expect(container).toBeEmptyDOMElement();
  });
});
