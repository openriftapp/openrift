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

  it("sizes the input group with the caller's class", () => {
    mockUseFilterValues.mockReturnValue({
      filterState: { search: "" },
      hasActiveFilters: false,
      view: "cards",
    });
    mockUseFilterActions.mockReturnValue({ setSearch: vi.fn() });
    const { container } = render(
      <SearchBar totalCards={40} filteredCount={40} inputClassName="max-sm:h-11" />,
    );
    expect(container.querySelector('[data-slot="input-group"]')).toHaveClass(
      "w-full",
      "max-sm:h-11",
    );
  });
});

describe("SearchBar count", () => {
  function renderCount(search: string) {
    mockUseFilterValues.mockReturnValue({
      filterState: { search },
      hasActiveFilters: search !== "",
      view: "cards",
    });
    mockUseFilterActions.mockReturnValue({ setSearch: vi.fn() });
    render(<SearchBar totalCards={40} filteredCount={search ? 12 : 40} countInPlaceholder />);
  }

  it("puts the total in the placeholder when asked to", () => {
    renderCount("");

    expect(screen.getByPlaceholderText("Search 40 cards")).toBeInTheDocument();
    expect(screen.queryByText("40 cards")).not.toBeInTheDocument();
  });

  it("falls back to the trailing filtered count while a query narrows the list", () => {
    renderCount("teemo");

    expect(screen.getByPlaceholderText("Search…")).toBeInTheDocument();
    expect(screen.getByText("12 / 40 cards")).toBeInTheDocument();
  });

  it("keeps the trailing count by default", () => {
    setup();

    expect(screen.getByPlaceholderText("Search…")).toBeInTheDocument();
    expect(screen.getByText("40 cards")).toBeInTheDocument();
  });

  it("puts the count under the field when countBelow is set", () => {
    mockUseFilterValues.mockReturnValue({
      filterState: { search: "" },
      hasActiveFilters: false,
      view: "cards",
    });
    mockUseFilterActions.mockReturnValue({ setSearch: vi.fn() });
    render(<SearchBar totalCards={40} filteredCount={40} countBelow />);

    expect(screen.getByText("40 cards").tagName).toBe("P");
  });
});

describe("SearchBar syntax help", () => {
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
