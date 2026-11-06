import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CardSearchResult } from "@/features/cards/lib/card-search-result";

import { CardSearchDropdown, CatalogSearchCombobox } from "./card-search-dropdown";

const RESULTS: CardSearchResult[] = [
  { id: "azir", label: "Azir, Emperor of the Sands", sublabel: "emperor-of-the-sands" },
  { id: "jinx", label: "Jinx, Rebel", sublabel: "jinx-rebel" },
];

function Dropdown({ results }: { results: CardSearchResult[] }) {
  return (
    <CardSearchDropdown
      results={results}
      onSearch={vi.fn()}
      onSelect={vi.fn()}
      ariaLabel="Legend"
    />
  );
}

describe("CardSearchDropdown", () => {
  it("renders every row the surface matched, even when the label does not contain the query", async () => {
    const user = userEvent.setup();
    render(<Dropdown results={RESULTS} />);

    await user.type(screen.getByRole("combobox", { name: "Legend" }), "ogn202");

    expect(
      await screen.findByRole("option", { name: /Azir, Emperor of the Sands/u }),
    ).toBeVisible();
    expect(screen.getByRole("option", { name: /Jinx, Rebel/u })).toBeVisible();
  });

  it("shows the empty message only when the surface matched nothing", async () => {
    const user = userEvent.setup();
    render(<Dropdown results={[]} />);

    await user.type(screen.getByRole("combobox", { name: "Legend" }), "azir");

    expect(await screen.findByText("No matching cards")).toBeVisible();
  });
});

describe("CardSearchDropdown picking", () => {
  it("fills the input with the picked label and reports the pick", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onRawInputChange = vi.fn();
    render(
      <CardSearchDropdown
        results={RESULTS}
        onSearch={vi.fn()}
        onSelect={onSelect}
        onRawInputChange={onRawInputChange}
        ariaLabel="Legend"
      />,
    );

    const input = screen.getByRole("combobox", { name: "Legend" });
    await user.type(input, "jin");
    await user.click(await screen.findByRole("option", { name: /Jinx, Rebel/u }));

    expect(onSelect).toHaveBeenCalledExactlyOnceWith("jinx", RESULTS[1]);
    expect(input).toHaveValue("Jinx, Rebel");
    expect(onRawInputChange).toHaveBeenLastCalledWith("Jinx, Rebel");
  });

  it("debounces the search query", async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(
      <CardSearchDropdown
        results={RESULTS}
        onSearch={onSearch}
        onSelect={vi.fn()}
        ariaLabel="Legend"
      />,
    );

    await user.type(screen.getByRole("combobox", { name: "Legend" }), "jin");

    expect(onSearch).not.toHaveBeenCalled();
    await waitFor(() => expect(onSearch).toHaveBeenCalledWith("jin"));
    expect(onSearch).toHaveBeenCalledOnce();
  });

  it("starts from the initial query", () => {
    render(
      <CardSearchDropdown
        results={RESULTS}
        onSearch={vi.fn()}
        onSelect={vi.fn()}
        ariaLabel="Legend"
        initialQuery="Azir"
      />,
    );
    expect(screen.getByRole("combobox", { name: "Legend" })).toHaveValue("Azir");
  });

  it("clears a pick with the clear button and shows no chevron", async () => {
    const user = userEvent.setup();
    const onRawInputChange = vi.fn();
    const { container } = render(
      <CardSearchDropdown
        results={RESULTS}
        onSearch={vi.fn()}
        onSelect={vi.fn()}
        onRawInputChange={onRawInputChange}
        ariaLabel="Legend"
      />,
    );

    const input = screen.getByRole("combobox", { name: "Legend" });
    await user.type(input, "azir");
    await user.click(await screen.findByRole("option", { name: /Azir/u }));
    expect(container.querySelector("[data-slot=combobox-trigger]")).toBeNull();
    const clear = container.querySelector<HTMLElement>("[data-slot=combobox-clear]");
    expect(clear).not.toBeNull();
    await user.click(clear as HTMLElement);

    expect(input).toHaveValue("");
    expect(onRawInputChange).toHaveBeenLastCalledWith("");
  });

  it("renders the thumbnail, sublabel and detail of a row", async () => {
    const user = userEvent.setup();
    render(
      <CardSearchDropdown
        results={[
          {
            id: "vi",
            label: "Vi",
            sublabel: "vi-enforcer",
            detail: "Champion Unit",
            leading: <span data-testid="thumb" />,
          },
        ]}
        onSearch={vi.fn()}
        onSelect={vi.fn()}
        ariaLabel="Legend"
      />,
    );

    await user.type(screen.getByRole("combobox", { name: "Legend" }), "v");

    const row = await screen.findByRole("option", { name: /Vi/u });
    expect(within(row).getByTestId("thumb")).toBeInTheDocument();
    expect(row).toHaveTextContent("Vivi-enforcerChampion Unit");
  });
});

describe("CatalogSearchCombobox", () => {
  it("previews the highlighted row", async () => {
    const user = userEvent.setup();
    render(
      <CatalogSearchCombobox<CardSearchResult>
        results={RESULTS}
        getKey={(item) => item.id}
        renderItem={(item) => item.label}
        onSelect={vi.fn()}
        onQueryChange={vi.fn()}
        ariaLabel="Printing"
        renderActivePreview={(item) => <div data-testid="preview">{item.id}</div>}
      />,
    );

    await user.type(screen.getByRole("combobox", { name: "Printing" }), "a");
    await screen.findByRole("option", { name: /Azir/u });
    await user.keyboard("{ArrowDown}");

    expect(await screen.findByTestId("preview")).toHaveTextContent("azir");
  });

  it("reports the picked item", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <CatalogSearchCombobox<CardSearchResult>
        results={RESULTS}
        getKey={(item) => item.id}
        renderItem={(item) => item.label}
        itemToInputValue={(item) => item.label}
        onSelect={onSelect}
        onQueryChange={vi.fn()}
        ariaLabel="Printing"
      />,
    );

    await user.type(screen.getByRole("combobox", { name: "Printing" }), "a");
    await user.click(await screen.findByRole("option", { name: /Azir/u }));

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(RESULTS[0]);
  });
});

describe("CardSearchDropdown loading", () => {
  it("shows the loading rows in place of results and the empty message", async () => {
    const user = userEvent.setup();
    render(
      <CardSearchDropdown
        results={[]}
        loading
        onSearch={vi.fn()}
        onSelect={vi.fn()}
        ariaLabel="Legend"
      />,
    );

    await user.type(screen.getByRole("combobox", { name: "Legend" }), "azir");

    expect(screen.queryByText("No matching cards")).not.toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });
});
