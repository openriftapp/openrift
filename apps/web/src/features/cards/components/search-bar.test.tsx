import type { SearchVocabulary } from "@openrift/shared/search-query/bind";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Root } from "react-dom/client";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
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
  vi.useRealTimers();
});

describe("SearchBar", () => {
  it("clears the query via the clear button", async () => {
    const user = userEvent.setup();
    const actions = setup({ search: "teemo" });

    await user.click(screen.getByRole("button", { name: "Clear search" }));

    expect(actions.setSearch).toHaveBeenCalledWith("");
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

  it("pluralizes the trailing unit through the messages", () => {
    mockUseFilterValues.mockReturnValue({
      filterState: { search: "" },
      hasActiveFilters: false,
      view: "printings",
    });
    mockUseFilterActions.mockReturnValue({ setSearch: vi.fn() });
    render(<SearchBar totalCards={1} filteredCount={1} />);

    expect(screen.getByText("1 printing")).toBeInTheDocument();
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

  it("puts the caret right after a suggestion picked in the middle of the query", async () => {
    const user = userEvent.setup();
    setup();
    const input = screen.getByRole("textbox") as HTMLInputElement;

    await user.click(input);
    await user.keyboard(" fury{Home}dom");
    fireEvent.click(screen.getByRole("option", { name: /domain:/u }));

    expect(input).toHaveValue("domain: fury");
    expect(input.selectionStart).toBe(7);
    expect(input.selectionEnd).toBe(7);
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

describe("SearchBar hydration", () => {
  async function hydrateAfter(prepare: (input: HTMLInputElement) => void) {
    const actions = { setSearch: vi.fn() };
    mockUseFilterValues.mockReturnValue({
      filterState: { search: "" },
      hasActiveFilters: false,
      view: "cards",
    });
    mockUseFilterActions.mockReturnValue(actions);
    const bar = <SearchBar totalCards={40} filteredCount={40} />;
    const container = document.createElement("div");
    container.innerHTML = renderToString(bar);
    document.body.append(container);
    const input = container.querySelector("input") as HTMLInputElement;
    prepare(input);

    let root: Root | undefined;
    await act(async () => {
      root = hydrateRoot(container, bar);
    });
    return {
      actions,
      input,
      container,
      cleanup: () => {
        root?.unmount();
        container.remove();
      },
    };
  }

  it("adopts and commits text typed into the focused input before hydration", async () => {
    vi.useFakeTimers();
    const { actions, input, container, cleanup } = await hydrateAfter((serverInput) => {
      serverInput.focus();
      serverInput.value = "jinx";
    });

    expect(container.querySelector("input")).toBe(input);
    expect(input.value).toBe("jinx");
    expect(document.activeElement).toBe(input);

    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(actions.setSearch).toHaveBeenCalledWith("jinx");

    cleanup();
  });

  it("does not run text the browser restored into an unfocused input", async () => {
    vi.useFakeTimers();
    const { actions, cleanup } = await hydrateAfter((serverInput) => {
      serverInput.value = "restored";
    });

    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(actions.setSearch).not.toHaveBeenCalled();

    cleanup();
  });
});

describe("SearchBar pending counts", () => {
  it("leaves the count out of the field and the search event", async () => {
    vi.useFakeTimers();
    mockUseFilterValues.mockReturnValue({
      filterState: { search: "" },
      hasActiveFilters: false,
      view: "cards",
    });
    mockUseFilterActions.mockReturnValue({ setSearch: vi.fn() });
    render(<SearchBar totalCards={40} filteredCount={40} countsPending />);

    expect(screen.queryByText("40 cards")).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "jinx" } });
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(mockTrackEvent).toHaveBeenCalledWith("search", { query: "jinx" });
  });
});
