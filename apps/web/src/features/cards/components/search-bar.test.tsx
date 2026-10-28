import type { SearchVocabulary } from "@openrift/shared/search-query/bind";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { mockUseFilterValues, mockUseFilterActions, mockTrackEvent } = vi.hoisted(() => ({
  mockUseFilterValues: vi.fn(),
  mockUseFilterActions: vi.fn(),
  mockTrackEvent: vi.fn(),
}));

vi.mock("@/features/cards/hooks/use-card-filters", () => ({
  useFilterValues: mockUseFilterValues,
  useFilterActions: mockUseFilterActions,
}));

vi.mock("@/lib/analytics", () => ({
  trackEvent: mockTrackEvent,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to: _to,
    params: _params,
    children,
    ...props
  }: React.ComponentProps<"a"> & { to?: string; params?: unknown }) => (
    <a {...props} href="/help/search-syntax">
      {children}
    </a>
  ),
}));

// oxlint-disable-next-line import/first -- must import after vi.mock
import { SearchBar } from "./search-bar";

function setup({
  search = "",
  suggestionVocabulary,
}: {
  search?: string;
  suggestionVocabulary?: SearchVocabulary;
} = {}) {
  const actions = { setSearch: vi.fn() };
  mockUseFilterValues.mockReturnValue({
    filterState: { search },
    hasActiveFilters: search !== "",
    view: "cards",
  });
  mockUseFilterActions.mockReturnValue(actions);
  render(
    <SearchBar totalCards={40} filteredCount={12} suggestionVocabulary={suggestionVocabulary} />,
  );
  return actions;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("SearchBar", () => {
  it("clears the query via the clear button", async () => {
    const user = userEvent.setup();
    const actions = setup({ search: "teemo" });

    await user.click(screen.getByRole("button", { name: "Clear search" }));

    expect(actions.setSearch).toHaveBeenCalledWith("");
  });
});

describe("SearchBar query chips", () => {
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

  it("shows no chips for a plain-word query", () => {
    setup({ search: "teemo" });

    expect(screen.queryByRole("list", { name: "Search terms" })).not.toBeInTheDocument();
  });

  it("flags an unknown key and a malformed value", () => {
    setup({ search: "foo:bar e<=x" });

    expect(screen.getByText("Unknown key “foo:”, searched as text")).toBeInTheDocument();
    expect(screen.getByText("“x” doesn't work with e:")).toBeInTheDocument();
  });

  it("warns about a value outside the vocabulary", () => {
    mockUseFilterValues.mockReturnValue({
      filterState: { search: "d:purple" },
      hasActiveFilters: true,
      view: "cards",
    });
    mockUseFilterActions.mockReturnValue({ setSearch: vi.fn() });
    render(
      <SearchBar totalCards={40} filteredCount={0} validationVocabulary={{ domain: ["fury"] }} />,
    );

    expect(screen.getByText("No domain called “purple”")).toBeInTheDocument();
  });

  it("links to the syntax help from the field", () => {
    setup();

    expect(screen.getByRole("link", { name: "Search syntax" })).toHaveAttribute(
      "href",
      "/help/search-syntax",
    );
  });
});

describe("SearchBar suggestions", () => {
  it("offers keys while one is typed and inserts the picked one", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("textbox"));
    await user.keyboard("dom");
    await user.click(screen.getByRole("option", { name: /domain:/u }));

    expect(screen.getByRole("textbox")).toHaveValue("domain:");
  });

  it("offers vocabulary values after a key and accepts with Tab", async () => {
    const user = userEvent.setup();
    mockUseFilterValues.mockReturnValue({
      filterState: { search: "" },
      hasActiveFilters: false,
      view: "cards",
    });
    mockUseFilterActions.mockReturnValue({ setSearch: vi.fn() });
    render(
      <SearchBar
        totalCards={40}
        filteredCount={40}
        suggestionVocabulary={{ domain: ["fury", "calm"] }}
      />,
    );

    await user.click(screen.getByRole("textbox"));
    await user.keyboard("d:f");
    expect(screen.getByRole("option", { name: /fury/u })).toBeInTheDocument();
    await user.keyboard("{Tab}");

    expect(screen.getByRole("textbox")).toHaveValue("d:fury ");
  });

  it("hides the clause chips while the suggestion list is open", async () => {
    const user = userEvent.setup();
    setup({ suggestionVocabulary: { type: ["unit"] } });

    await user.click(screen.getByRole("textbox"));
    await user.keyboard("t:uni");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.queryByText("type contains “uni”")).not.toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.getByText("type contains “uni”")).toBeInTheDocument();
  });

  it("lets Tab leave the field while only key suggestions show", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("textbox"));
    await user.keyboard("a");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Tab}");

    expect(screen.getByRole("textbox")).not.toHaveFocus();
    expect(screen.getByRole("textbox")).toHaveValue("a");
  });

  it("moves the highlight with the arrow keys and accepts with Enter", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("textbox"));
    await user.keyboard("is:");
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(screen.getByRole("textbox")).toHaveValue("is:metal ");
  });

  it("closes the list with Escape", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole("textbox"));
    await user.keyboard("is:");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
