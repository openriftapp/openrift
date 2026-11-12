import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";

import { ComboboxPicker, matchesPickerQuery, summarizePickerSelection } from "./combobox-picker";

const ORIGINS = { value: "ogn", label: "Origins", keywords: "OGN" };
const SPIRITFORGED = { value: "sfd", label: "Spiritforged", keywords: "SFD" };
const UNLEASHED = { value: "unl", label: "Unleashed" };
const OPTIONS = [ORIGINS, SPIRITFORGED, UNLEASHED];

describe("summarizePickerSelection", () => {
  it("joins labels in option order with a comma", () => {
    expect(summarizePickerSelection(OPTIONS, ["unl", "ogn"])).toBe("Origins, Unleashed");
  });

  it("keeps values without an option at the end", () => {
    expect(summarizePickerSelection(OPTIONS, ["gone", "sfd"])).toBe("Spiritforged, gone");
  });

  it("returns an empty string for no selection", () => {
    expect(summarizePickerSelection(OPTIONS, [])).toBe("");
  });
});

describe("matchesPickerQuery", () => {
  it("matches label and keywords case-insensitively", () => {
    expect(matchesPickerQuery(ORIGINS, "orig")).toBe(true);
    expect(matchesPickerQuery(SPIRITFORGED, "sfd")).toBe(true);
    expect(matchesPickerQuery(UNLEASHED, "sfd")).toBe(false);
  });

  it("matches everything for a blank query", () => {
    expect(matchesPickerQuery(UNLEASHED, "  ")).toBe(true);
  });

  it("folds accents and apostrophes on both sides", () => {
    expect(matchesPickerQuery({ value: "x", label: "Kai’Sa Évolution" }, "kai'sa evo")).toBe(true);
  });
});

describe("ComboboxPicker", () => {
  it("shows the placeholder and then the selection summary in the trigger", () => {
    const { rerender } = render(
      <ComboboxPicker
        multiple
        aria-label="Sets"
        options={OPTIONS}
        value={[]}
        onChange={() => undefined}
        placeholder="None"
        emptyText="No matches."
      />,
    );
    expect(screen.getByRole("combobox", { name: "Sets" })).toHaveTextContent("None");

    rerender(
      <ComboboxPicker
        multiple
        aria-label="Sets"
        options={OPTIONS}
        value={["sfd", "ogn"]}
        onChange={() => undefined}
        placeholder="None"
        emptyText="No matches."
      />,
    );
    expect(screen.getByRole("combobox", { name: "Sets" })).toHaveTextContent(
      "Origins, Spiritforged",
    );
  });

  it("adds a value in multiple mode", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ComboboxPicker
        multiple
        aria-label="Sets"
        options={OPTIONS}
        value={["ogn"]}
        onChange={onChange}
        emptyText="No matches."
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Sets" }));
    await user.click(await screen.findByRole("option", { name: "Unleashed" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith(["ogn", "unl"]);
  });

  it("filters by the popup search and shows the empty text", async () => {
    const user = userEvent.setup();
    render(
      <ComboboxPicker
        aria-label="Set"
        options={OPTIONS}
        value={null}
        onChange={() => undefined}
        searchPlaceholder="Search sets…"
        emptyText="No matching sets."
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Set" }));
    await user.type(await screen.findByPlaceholderText("Search sets…"), "spir");

    expect(screen.getByRole("option", { name: "Spiritforged" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Origins" })).not.toBeInTheDocument();

    await user.clear(screen.getByPlaceholderText("Search sets…"));
    await user.type(screen.getByPlaceholderText("Search sets…"), "zz");
    expect(screen.getByText("No matching sets.")).toBeInTheDocument();
  });

  it("runs an action with the typed query instead of changing the value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onCreate = vi.fn();
    render(
      <ComboboxPicker
        trigger="input"
        aria-label="Source"
        options={OPTIONS}
        value={null}
        onChange={onChange}
        emptyText="No sources yet."
        actions={[{ key: "create", label: (query) => `Create “${query}”`, onSelect: onCreate }]}
      />,
    );

    await user.type(screen.getByRole("combobox", { name: "Source" }), "Vendetta");
    await user.click(await screen.findByRole("option", { name: "Create “Vendetta”" }));

    expect(onCreate).toHaveBeenCalledExactlyOnceWith("Vendetta");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("draws the separator above actions only when an option row is visible", async () => {
    const user = userEvent.setup();
    render(
      <ComboboxPicker
        trigger="input"
        aria-label="Source"
        options={OPTIONS}
        value={null}
        onChange={() => undefined}
        emptyText="No sources yet."
        actions={[{ key: "create", label: (query) => `Create “${query}”`, onSelect: vi.fn() }]}
      />,
    );
    const input = screen.getByRole("combobox", { name: "Source" });

    await user.type(input, "zz");
    await screen.findByRole("option", { name: "Create “zz”" });
    expect(document.querySelector('[data-slot="combobox-separator"]')).toBeNull();

    await user.clear(input);
    await user.type(input, "orig");
    await screen.findByRole("option", { name: "Create “orig”" });
    expect(document.querySelector('[data-slot="combobox-separator"]')).not.toBeNull();
  });

  it("hides actions while the query is empty", async () => {
    const user = userEvent.setup();
    render(
      <ComboboxPicker
        trigger="input"
        aria-label="Source"
        options={OPTIONS}
        value={null}
        onChange={() => undefined}
        emptyText="No sources yet."
        actions={[{ key: "create", label: () => "Create", onSelect: () => undefined }]}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Source" }));
    await user.keyboard("{ArrowDown}");

    expect(await screen.findByRole("option", { name: "Origins" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Create" })).not.toBeInTheDocument();
  });

  it("shows the hint in place of the list", async () => {
    const user = userEvent.setup();
    render(
      <ComboboxPicker
        aria-label="Shop"
        options={OPTIONS}
        value={null}
        onChange={() => undefined}
        emptyText="No shops."
        hint="Type a shop or town name"
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Shop" }));

    expect(await screen.findByText("Type a shop or town name")).toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("selects with the keyboard in single mode", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ComboboxPicker
        aria-label="Set"
        options={OPTIONS}
        value={null}
        onChange={onChange}
        searchPlaceholder="Search sets…"
        emptyText="No matching sets."
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Set" }));
    await user.type(await screen.findByPlaceholderText("Search sets…"), "unl");
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith("unl");
  });
});

describe("ComboboxPicker rows", () => {
  it("runs a row's onSelect and leaves the value alone", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onCycle = vi.fn();
    render(
      <ComboboxPicker
        multiple
        aria-label="Sets"
        options={[ORIGINS, { ...UNLEASHED, onSelect: onCycle, indicator: <span>mark</span> }]}
        value={[]}
        onChange={onChange}
        emptyText="No matches."
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Sets" }));
    const row = await screen.findByRole("option", { name: /Unleashed/u });
    expect(row).toHaveTextContent("mark");
    await user.click(row);

    expect(onCycle).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("heads sections and divides them, following the search", async () => {
    const user = userEvent.setup();
    render(
      <ComboboxPicker
        aria-label="Set"
        options={[
          { ...ORIGINS, group: "main" },
          { ...SPIRITFORGED, group: "main", belowDivider: true },
          { ...UNLEASHED, group: "promo" },
        ]}
        groupLabels={new Map([["promo", "Promos"]])}
        value={null}
        onChange={() => undefined}
        searchPlaceholder="Search sets…"
        emptyText="No matches."
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Set" }));
    const list = await screen.findByRole("listbox");
    expect(list.querySelectorAll('[data-slot="combobox-separator"]')).toHaveLength(2);
    expect(within(list).getByText("Promos")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Search sets…"), "spirit");
    expect(list.querySelectorAll('[data-slot="combobox-separator"]')).toHaveLength(0);
    expect(within(list).queryByText("Promos")).not.toBeInTheDocument();
  });

  it("labels a value from selectedOptions without listing it", async () => {
    const user = userEvent.setup();
    render(
      <ComboboxPicker
        aria-label="Set"
        options={[ORIGINS]}
        selectedOptions={[{ value: "gone", label: "Proving Grounds" }]}
        value="gone"
        onChange={() => undefined}
        emptyText="No matches."
      />,
    );

    const trigger = screen.getByRole("combobox", { name: "Set" });
    expect(trigger).toHaveTextContent("Proving Grounds");
    await user.click(trigger);
    expect(await screen.findAllByRole("option")).toHaveLength(1);
  });

  it("renders a chip trigger with the summary", () => {
    render(
      <ComboboxPicker
        multiple
        trigger="chip"
        aria-label="Sets"
        options={OPTIONS}
        value={["ogn"]}
        onChange={() => undefined}
        emptyText="No matches."
      />,
    );
    expect(screen.getByRole("combobox", { name: "Sets" })).toHaveTextContent("Origins");
  });

  it("keeps a hidden search field for keyboard picks", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ComboboxPicker
        aria-label="Set"
        options={OPTIONS}
        value={null}
        onChange={onChange}
        searchable="hidden"
        searchPlaceholder="Search sets…"
        emptyText="No matches."
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Set" }));
    await screen.findByRole("option", { name: "Origins" });
    expect(
      screen.getByPlaceholderText("Search sets…").closest("[data-slot=input-group]"),
    ).toHaveClass("sr-only");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith("ogn");
  });

  it("seeds the input from defaultQuery", () => {
    render(
      <ComboboxPicker
        trigger="input"
        aria-label="Set"
        options={OPTIONS}
        value={null}
        onChange={() => undefined}
        defaultQuery="Ori"
        emptyText="No matches."
      />,
    );
    expect(screen.getByRole("combobox", { name: "Set" })).toHaveValue("Ori");
  });
});

function FreeText({ onChange }: { onChange?: (value: string | null) => void }) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <ComboboxPicker
      trigger="input"
      freeText
      aria-label="Source"
      options={OPTIONS}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
      createLabel={(typed) => `Create “${typed}”`}
      emptyText="No sources yet."
    />
  );
}

describe("ComboboxPicker free text", () => {
  it("lists unmatched text only as a create row", async () => {
    const user = userEvent.setup();
    render(<FreeText />);

    await user.type(screen.getByRole("combobox", { name: "Source" }), "Vendetta");

    const rows = await screen.findAllByRole("option");
    expect(rows.map((row) => row.textContent)).toEqual(["Create “Vendetta”"]);
    expect(rows[0]).not.toHaveAttribute("aria-selected", "true");
  });

  it("lists matched text only as its option, unchecked", async () => {
    const user = userEvent.setup();
    render(<FreeText />);

    await user.type(screen.getByRole("combobox", { name: "Source" }), "origins");

    const rows = await screen.findAllByRole("option");
    expect(rows.map((row) => row.textContent)).toEqual(["Origins"]);
    expect(rows[0]).not.toHaveAttribute("aria-selected", "true");
  });

  it("takes the typed text as the value and keeps it on close", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FreeText onChange={onChange} />);

    const input = screen.getByRole("combobox", { name: "Source" });
    await user.type(input, "Vendetta");
    await user.keyboard("{Escape}");
    await user.tab();

    expect(onChange).toHaveBeenLastCalledWith("Vendetta");
    expect(input).toHaveValue("Vendetta");
  });

  it("commits the trimmed text from the create row", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FreeText onChange={onChange} />);

    await user.type(screen.getByRole("combobox", { name: "Source" }), "Vendetta ");
    await user.click(await screen.findByRole("option", { name: "Create “Vendetta”" }));

    expect(onChange).toHaveBeenLastCalledWith("Vendetta");
  });

  it("offers no create row for an existing option in any case", async () => {
    const user = userEvent.setup();
    render(<FreeText />);

    await user.type(screen.getByRole("combobox", { name: "Source" }), "origins");

    expect(await screen.findByRole("option", { name: "Origins" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Create/u })).not.toBeInTheDocument();
  });

  it("takes a picked suggestion and shows it in the input", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FreeText onChange={onChange} />);

    const input = screen.getByRole("combobox", { name: "Source" });
    await user.type(input, "unl");
    await user.click(await screen.findByRole("option", { name: "Unleashed" }));

    expect(onChange).toHaveBeenLastCalledWith("unl");
    expect(input).toHaveValue("unl");
  });
});

describe("ComboboxPicker popup control", () => {
  it("shows the selected label in an input trigger", () => {
    render(
      <ComboboxPicker
        trigger="input"
        aria-label="Set"
        options={OPTIONS}
        value="sfd"
        onChange={() => undefined}
        emptyText="No matches."
      />,
    );
    expect(screen.getByRole("combobox", { name: "Set" })).toHaveValue("Spiritforged");
  });

  it("lists every option when it opens on the selected label", async () => {
    const user = userEvent.setup();
    render(
      <ComboboxPicker
        trigger="input"
        aria-label="Set"
        options={OPTIONS}
        value="sfd"
        onChange={() => undefined}
        emptyText="No matches."
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Set" }));
    await user.keyboard("{ArrowDown}");

    expect(await screen.findAllByRole("option")).toHaveLength(3);
  });

  it("reports open changes of a controlled popup", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <ComboboxPicker
        aria-label="Set"
        options={OPTIONS}
        value={null}
        onChange={() => undefined}
        open
        onOpenChange={onOpenChange}
        emptyText="No matches."
      />,
    );

    expect(await screen.findByRole("option", { name: "Origins" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("opens on focus when asked", async () => {
    const user = userEvent.setup();
    render(
      <ComboboxPicker
        trigger="input"
        openOnFocus
        aria-label="Set"
        options={OPTIONS}
        value={null}
        onChange={() => undefined}
        emptyText="No matches."
      />,
    );

    await user.tab();

    expect(await screen.findByRole("option", { name: "Origins" })).toBeInTheDocument();
  });

  it("renders the list inline without opening anything", () => {
    render(
      <ComboboxPicker
        trigger="input"
        inline
        aria-label="Set"
        options={OPTIONS}
        value={null}
        onChange={() => undefined}
        emptyText="No matches."
      />,
    );
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("starts open with defaultOpen", async () => {
    render(
      <ComboboxPicker
        aria-label="Set"
        options={OPTIONS}
        value={null}
        onChange={() => undefined}
        defaultOpen
        emptyText="No matches."
      />,
    );
    expect(await screen.findByRole("option", { name: "Origins" })).toBeInTheDocument();
  });
});

describe("ComboboxPicker input events", () => {
  it("skips its own Enter handling when the consumer prevents it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onEnter = vi.fn();
    render(
      <ComboboxPicker
        trigger="input"
        aria-label="Set"
        options={OPTIONS}
        value={null}
        onChange={onChange}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onEnter();
          }
        }}
        emptyText="No matches."
      />,
    );

    await user.type(screen.getByRole("combobox", { name: "Set" }), "ori");
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onEnter).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("calls onCancel on Escape and onFocus on focus", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onFocus = vi.fn();
    render(
      <ComboboxPicker
        trigger="input"
        aria-label="Set"
        options={OPTIONS}
        value={null}
        onChange={() => undefined}
        onCancel={onCancel}
        onFocus={onFocus}
        emptyText="No matches."
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Set" }));
    await user.keyboard("{Escape}");

    expect(onFocus).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

describe("ComboboxPicker extras", () => {
  it("disables an action row", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(
      <ComboboxPicker
        trigger="input"
        aria-label="Source"
        options={OPTIONS}
        value={null}
        onChange={() => undefined}
        emptyText="No sources yet."
        actions={[{ key: "create", label: () => "Create", onSelect: onCreate, disabled: true }]}
      />,
    );

    await user.type(screen.getByRole("combobox", { name: "Source" }), "x");

    expect(await screen.findByRole("option", { name: "Create" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("announces loading text next to the skeleton rows", async () => {
    const user = userEvent.setup();
    render(
      <ComboboxPicker
        aria-label="Shop"
        options={[]}
        value={null}
        onChange={() => undefined}
        loading
        loadingText="Searching…"
        emptyText="No shops."
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Shop" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Searching…");
  });

  it("puts an icon and custom content on a custom button trigger", () => {
    render(
      <ComboboxPicker
        aria-label="Add shop"
        options={OPTIONS}
        value={null}
        onChange={() => undefined}
        triggerRender={<Button variant="outline" size="sm" />}
        triggerIcon={<span data-testid="icon" />}
        triggerLabel="Add shop"
        emptyText="No shops."
      />,
    );

    const trigger = screen.getByRole("combobox", { name: "Add shop" });
    expect(within(trigger).getByTestId("icon")).toBeInTheDocument();
    expect(trigger).toHaveTextContent("Add shop");
  });
});
