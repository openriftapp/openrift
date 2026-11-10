import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { dimensionSign } from "@/lib/filter-sign";

import { MultiSelectCombobox } from "./multi-select-combobox";

const UNL_OPTION = { value: "unl", label: "Unlimited", prefix: "UNL" } as const;

function renderSets(props: Partial<Parameters<typeof MultiSelectCombobox>[0]> = {}) {
  const onChange = vi.fn();
  render(
    <MultiSelectCombobox
      triggerStyle="button"
      label="Sets"
      options={[UNL_OPTION]}
      selected={["ogn", "unl"]}
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange };
}

describe("MultiSelectCombobox orphan selections", () => {
  it("keeps a selected value visible after it drops out of the options", async () => {
    const user = userEvent.setup();
    renderSets();

    await user.click(screen.getByRole("combobox"));

    expect(await screen.findByRole("option", { name: /Unlimited/u })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "ogn" })).toBeInTheDocument();
  });

  it("lets the user clear a selected value that has no backing option", async () => {
    const user = userEvent.setup();
    const { onChange } = renderSets();

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "ogn" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith(["unl"]);
  });

  it("does not duplicate a selected value that is still available", async () => {
    const user = userEvent.setup();
    renderSets({ selected: ["unl"] });

    await user.click(screen.getByRole("combobox"));

    const list = await screen.findByRole("listbox");
    expect(within(list).getAllByRole("option")).toHaveLength(1);
  });
});

const SET_OPTIONS = [
  { value: "ogn", label: "Origins" },
  { value: "unl", label: "Unlimited" },
  { value: "btr", label: "Beyond the Rift" },
] as const;

function renderIncludeExclude(include: string[], exclude: string[]) {
  const onSignedToggle = vi.fn();
  const onSignFlip = vi.fn();
  render(
    <MultiSelectCombobox
      triggerStyle="button"
      label="Sets"
      placeholder="Any"
      options={SET_OPTIONS}
      selected={include}
      excluded={exclude}
      sign={dimensionSign(include, exclude)}
      onSignedToggle={onSignedToggle}
      onSignFlip={onSignFlip}
    />,
  );
  return { onSignedToggle, onSignFlip };
}

describe("MultiSelectCombobox include/exclude summary", () => {
  it("shows the placeholder when nothing is selected", () => {
    renderIncludeExclude([], []);
    expect(screen.getByRole("combobox")).toHaveTextContent("Any");
  });

  it("names a single included value with a + prefix", () => {
    renderIncludeExclude(["ogn"], []);
    expect(screen.getByRole("combobox")).toHaveTextContent("+Origins");
  });

  it("counts multiple included values", () => {
    renderIncludeExclude(["ogn", "unl"], []);
    expect(screen.getByRole("combobox")).toHaveTextContent("+2");
  });

  it("names a single excluded value with a − prefix", () => {
    renderIncludeExclude([], ["unl"]);
    expect(screen.getByRole("combobox")).toHaveTextContent("−Unlimited");
  });

  it("summarises both buckets together instead of a bare count", () => {
    renderIncludeExclude(["ogn"], ["unl", "btr"]);
    expect(screen.getByRole("combobox")).toHaveTextContent("+Origins, −2");
  });
});

describe("MultiSelectCombobox signed rows", () => {
  it("routes a row click to onSignedToggle with the option's value and the include sign", async () => {
    const user = userEvent.setup();
    const { onSignedToggle } = renderIncludeExclude([], []);

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Origins" }));

    expect(onSignedToggle).toHaveBeenCalledExactlyOnceWith("ogn", "include");
  });

  it("toggles an already-included row on the include sign", async () => {
    const user = userEvent.setup();
    const { onSignedToggle } = renderIncludeExclude(["ogn"], []);

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Origins" }));

    expect(onSignedToggle).toHaveBeenCalledExactlyOnceWith("ogn", "include");
  });

  it("shows the dimension's sign in the switch", async () => {
    const user = userEvent.setup();
    renderIncludeExclude([], ["unl"]);

    await user.click(screen.getByRole("combobox"));

    const group = await screen.findByRole("group", { name: "Sets: include or exclude" });
    expect(within(group).getByRole("button", { name: "Exclude" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("excludes the next pick after switching an empty dimension to Exclude", async () => {
    const user = userEvent.setup();
    const { onSignedToggle, onSignFlip } = renderIncludeExclude([], []);

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("button", { name: "Exclude" }));
    await user.click(await screen.findByRole("option", { name: "Origins" }));

    expect(onSignFlip).not.toHaveBeenCalled();
    expect(onSignedToggle).toHaveBeenCalledExactlyOnceWith("ogn", "exclude");
  });

  it("flips a dimension with values through onSignFlip", async () => {
    const user = userEvent.setup();
    const { onSignedToggle, onSignFlip } = renderIncludeExclude(["ogn"], []);

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("button", { name: "Exclude" }));

    expect(onSignFlip).toHaveBeenCalledOnce();
    expect(onSignedToggle).not.toHaveBeenCalled();
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("keeps an excluded value with no backing option visible and cyclable", async () => {
    const user = userEvent.setup();
    const onSignedToggle = vi.fn();
    render(
      <MultiSelectCombobox
        triggerStyle="button"
        label="Sets"
        placeholder="Any"
        options={[UNL_OPTION]}
        selected={[]}
        excluded={["ogn"]}
        sign="exclude"
        onSignedToggle={onSignedToggle}
        onSignFlip={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "ogn" }));

    expect(onSignedToggle).toHaveBeenCalledExactlyOnceWith("ogn", "exclude");
  });
});

function renderWithFlags(
  flags: { label: string; state: boolean | null; onToggle: () => void }[],
  flagPosition: "top" | "bottom" = "bottom",
) {
  const onSignedToggle = vi.fn();
  render(
    <MultiSelectCombobox
      triggerStyle="button"
      label="Art Variant"
      options={SET_OPTIONS}
      selected={[]}
      excluded={[]}
      sign={null}
      onSignedToggle={onSignedToggle}
      onSignFlip={vi.fn()}
      flags={flags}
      flagPosition={flagPosition}
    />,
  );
  return { onSignedToggle };
}

describe("MultiSelectCombobox flag rows", () => {
  it("routes a flag row click to that flag's onToggle and nowhere else", async () => {
    const user = userEvent.setup();
    const toggleOvernumbered = vi.fn();
    const toggleSigned = vi.fn();
    const { onSignedToggle } = renderWithFlags([
      { label: "Overnumbered", state: null, onToggle: toggleOvernumbered },
      { label: "Signed", state: null, onToggle: toggleSigned },
    ]);

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Signed" }));

    expect(toggleSigned).toHaveBeenCalledOnce();
    expect(toggleOvernumbered).not.toHaveBeenCalled();
    expect(onSignedToggle).not.toHaveBeenCalled();
  });

  it("lists every flag after the options with one divider before the block", async () => {
    const user = userEvent.setup();
    renderWithFlags([
      { label: "Overnumbered", state: null, onToggle: vi.fn() },
      { label: "Signed", state: null, onToggle: vi.fn() },
    ]);

    await user.click(screen.getByRole("combobox"));

    const list = await screen.findByRole("listbox");
    const names = within(list)
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(names).toEqual(["Origins", "Unlimited", "Beyond the Rift", "Overnumbered", "Signed"]);
    expect(list.querySelectorAll('[data-slot="combobox-separator"]')).toHaveLength(1);
  });

  it("leads with the flags and one divider after them at the top position", async () => {
    const user = userEvent.setup();
    renderWithFlags(
      [
        { label: "Has any marker", state: null, onToggle: vi.fn() },
        { label: "Signed", state: null, onToggle: vi.fn() },
      ],
      "top",
    );

    await user.click(screen.getByRole("combobox"));

    const list = await screen.findByRole("listbox");
    const names = within(list)
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(names).toEqual(["Has any marker", "Signed", "Origins", "Unlimited", "Beyond the Rift"]);
    expect(list.querySelectorAll('[data-slot="combobox-separator"]')).toHaveLength(1);
  });

  it("names a single active flag on the trigger and signs an excluded one", () => {
    renderWithFlags([
      { label: "Overnumbered", state: null, onToggle: vi.fn() },
      { label: "Signed", state: true, onToggle: vi.fn() },
    ]);
    expect(screen.getByRole("combobox")).toHaveTextContent("Signed");
  });

  it("summarises several active flags with their signs", () => {
    renderWithFlags([
      { label: "Overnumbered", state: false, onToggle: vi.fn() },
      { label: "Signed", state: true, onToggle: vi.fn() },
    ]);
    expect(screen.getByRole("combobox")).toHaveTextContent("−Overnumbered, Signed");
  });
});

const MARKER_OPTIONS = [
  { value: "promo", label: "Promo" },
  { value: "judge", label: "Judge" },
  ...["a", "b", "c", "d", "e", "f", "g"].map((suffix) => ({
    value: `event-${suffix}`,
    label: `Event ${suffix.toUpperCase()}`,
  })),
];

function renderInMenu(
  overrides: {
    selected?: string[];
    excluded?: string[];
    anyCount?: number;
    options?: readonly { value: string; label: string }[];
  } = {},
) {
  const onSignedToggle = vi.fn();
  render(
    <DropdownMenu>
      <DropdownMenuTrigger>More</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Banned</DropdownMenuItem>
        <MultiSelectCombobox
          triggerStyle="menu"
          label="Markers"
          searchPlaceholder="Search markers…"
          options={overrides.options ?? MARKER_OPTIONS}
          selected={overrides.selected ?? []}
          excluded={overrides.excluded ?? []}
          sign={dimensionSign(overrides.selected ?? [], overrides.excluded ?? [])}
          onSignedToggle={onSignedToggle}
          onSignFlip={vi.fn()}
          anyCount={overrides.anyCount}
        />
      </DropdownMenuContent>
    </DropdownMenu>,
  );
  return { onSignedToggle };
}

describe("MultiSelectCombobox inside a dropdown menu", () => {
  async function openTrigger(overrides: Parameters<typeof renderInMenu>[0]) {
    const user = userEvent.setup();
    renderInMenu(overrides);
    await user.click(screen.getByRole("button", { name: "More" }));
    return screen.findByRole("combobox");
  }

  it("drops the search field from a short menu picker and still picks with the keyboard", async () => {
    const user = userEvent.setup();
    const { onSignedToggle } = renderInMenu({ options: MARKER_OPTIONS.slice(0, 2) });

    await user.click(screen.getByRole("button", { name: "More" }));
    await user.click(await screen.findByText("Markers"));
    await screen.findByRole("option", { name: "Judge" });

    expect(
      screen.getByPlaceholderText("Search markers…").closest("[data-slot=input-group]"),
    ).toHaveClass("sr-only");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onSignedToggle).toHaveBeenCalledExactlyOnceWith("promo", "include");
  });

  it("shows the any-count next to the label while nothing is picked", async () => {
    const trigger = await openTrigger({ anyCount: 812 });
    expect(trigger).toHaveTextContent("Markers812");
  });

  it("keeps the label and swaps the any-count for a single picked value", async () => {
    const trigger = await openTrigger({ selected: ["judge"], anyCount: 812 });
    expect(trigger).toHaveTextContent("MarkersJudge");
    expect(trigger).not.toHaveTextContent("812");
  });

  it("summarises several picked values as a count", async () => {
    const trigger = await openTrigger({ selected: ["judge", "promo"] });
    expect(trigger).toHaveTextContent("Markers2 selected");
  });

  it("signs the summary once a value is excluded", async () => {
    const trigger = await openTrigger({ selected: ["promo"], excluded: ["judge"] });
    expect(trigger).toHaveTextContent("Markers+Promo, −Judge");
  });

  it("types the search query into the combobox input, not the menu's typeahead", async () => {
    const user = userEvent.setup();
    renderInMenu();

    await user.click(screen.getByRole("button", { name: "More" }));
    await user.click(await screen.findByText("Markers"));

    const input = await screen.findByPlaceholderText("Search markers…");
    await user.type(input, "promo");

    expect(input).toHaveValue("promo");
    expect(screen.queryByRole("option", { name: /Judge/u })).not.toBeInTheDocument();
  });

  it("still navigates and picks a row with the keyboard", async () => {
    const user = userEvent.setup();
    const { onSignedToggle } = renderInMenu();

    await user.click(screen.getByRole("button", { name: "More" }));
    await user.click(await screen.findByText("Markers"));
    await screen.findByPlaceholderText("Search markers…");

    await user.keyboard("{ArrowDown}{Enter}");

    expect(onSignedToggle).toHaveBeenCalledExactlyOnceWith("promo", "include");
  });
});

const RARITY_OPTIONS = [
  { value: "common", label: "Common" },
  { value: "rare", label: "Rare" },
  { value: "epic", label: "Epic" },
] as const;

function renderPlain(
  props: Partial<Parameters<typeof MultiSelectCombobox>[0]> & {
    triggerStyle: "chip" | "button";
    selected: string[];
  },
) {
  const onChange = vi.fn();
  render(
    <MultiSelectCombobox
      label="Rarities"
      options={RARITY_OPTIONS}
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange };
}

describe("MultiSelectCombobox trigger summaries", () => {
  it("shows the label on an empty chip", () => {
    renderPlain({ triggerStyle: "chip", selected: [] });
    expect(screen.getByRole("combobox")).toHaveTextContent("Rarities");
  });

  it("names a single picked value on a chip", () => {
    renderPlain({ triggerStyle: "chip", selected: ["rare"] });
    expect(screen.getByRole("combobox")).toHaveTextContent("Rare");
  });

  it("counts several picked values next to the label without a placeholder", () => {
    renderPlain({ triggerStyle: "chip", selected: ["rare", "epic"] });
    expect(screen.getByRole("combobox")).toHaveTextContent("Rarities (2)");
  });

  it("counts several picked values as 'N selected' with a placeholder", () => {
    renderPlain({ triggerStyle: "button", selected: ["rare", "epic"], placeholder: "Any" });
    expect(screen.getByRole("combobox")).toHaveTextContent("2 selected");
  });

  it("marks an active button trigger", () => {
    renderPlain({ triggerStyle: "button", selected: ["rare"] });
    expect(screen.getByRole("combobox")).toHaveAttribute("data-active");
  });

  it("leaves an idle button trigger unmarked", () => {
    renderPlain({ triggerStyle: "button", selected: [] });
    expect(screen.getByRole("combobox")).not.toHaveAttribute("data-active");
  });

  it("prefixes the summary label with the option prefix", () => {
    render(
      <MultiSelectCombobox
        triggerStyle="button"
        label="Sets"
        options={[UNL_OPTION]}
        selected={["unl"]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("combobox")).toHaveTextContent("UNL · Unlimited");
  });
});

describe("MultiSelectCombobox plain selection", () => {
  it("adds a clicked value through onChange", async () => {
    const user = userEvent.setup();
    const { onChange } = renderPlain({ triggerStyle: "chip", selected: ["rare"] });

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Epic" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith(["rare", "epic"]);
  });

  it("removes a clicked value that was selected", async () => {
    const user = userEvent.setup();
    const { onChange } = renderPlain({ triggerStyle: "chip", selected: ["rare", "epic"] });

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Rare" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith(["epic"]);
  });

  it("filters by the option prefix as well as the label", async () => {
    const user = userEvent.setup();
    render(
      <MultiSelectCombobox
        triggerStyle="button"
        label="Sets"
        searchPlaceholder="Search sets…"
        options={[UNL_OPTION, { value: "ogn", label: "Origins", prefix: "OGN" }]}
        selected={[]}
        onChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.type(await screen.findByPlaceholderText("Search sets…"), "unl");

    expect(screen.getByRole("option", { name: /Unlimited/u })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Origins/u })).not.toBeInTheDocument();
  });

  it("shows the empty text when the search matches nothing", async () => {
    const user = userEvent.setup();
    renderPlain({
      triggerStyle: "chip",
      selected: [],
      searchPlaceholder: "Search rarities…",
      emptyText: "No rarities",
    });

    await user.click(screen.getByRole("combobox"));
    await user.type(await screen.findByPlaceholderText("Search rarities…"), "zzz");

    expect(screen.getByText("No rarities")).toBeInTheDocument();
  });

  it("leaves Home to the search field's caret", async () => {
    const user = userEvent.setup();
    renderPlain({ triggerStyle: "chip", selected: [], searchPlaceholder: "Search rarities…" });

    await user.click(screen.getByRole("combobox"));
    const input = await screen.findByPlaceholderText<HTMLInputElement>("Search rarities…");
    await user.type(input, "ra");
    await user.keyboard("{Home}");

    expect(input.selectionStart).toBe(0);
  });
});

describe("MultiSelectCombobox row decorations", () => {
  it("shows counts and icons on the rows", async () => {
    const user = userEvent.setup();
    renderPlain({
      triggerStyle: "chip",
      selected: [],
      counts: new Map([
        ["common", 120],
        ["rare", 0],
      ]),
      icon: (value) => `/icons/${value}.webp`,
    });

    await user.click(screen.getByRole("combobox"));

    const common = await screen.findByRole("option", { name: /Common/u });
    expect(common).toHaveTextContent("Common120");
    expect(common.querySelector("img")).toHaveAttribute("src", "/icons/common.webp");
    expect(screen.getByRole("option", { name: /Rare/u })).toHaveTextContent("Rare0");
    expect(screen.getByRole("option", { name: /Epic/u })).toHaveTextContent(/^Epic$/u);
  });

  it("places the icon after the label when asked", async () => {
    const user = userEvent.setup();
    renderPlain({
      triggerStyle: "chip",
      selected: [],
      icon: (value) => `/icons/${value}.webp`,
      iconAfterLabel: true,
    });

    await user.click(screen.getByRole("combobox"));

    const common = await screen.findByRole("option", { name: /Common/u });
    const label = within(common).getByText("Common");
    expect(label.querySelector("img")).toHaveAttribute("src", "/icons/common.webp");
  });

  it("dims muted rows that are not selected and divides them from the rest", async () => {
    const user = userEvent.setup();
    renderPlain({
      triggerStyle: "chip",
      selected: ["epic"],
      mutedOptions: new Set(["rare", "epic"]),
    });

    await user.click(screen.getByRole("combobox"));

    const list = await screen.findByRole("listbox");
    expect(screen.getByRole("option", { name: "Common" })).not.toHaveClass("opacity-65");
    expect(screen.getByRole("option", { name: "Rare" })).toHaveClass("opacity-65");
    expect(screen.getByRole("option", { name: "Epic" })).not.toHaveClass("opacity-65");
    const separators = list.querySelectorAll('[data-slot="combobox-separator"]');
    expect(separators).toHaveLength(1);
    expect(separators[0]?.nextElementSibling).toHaveTextContent("Rare");
  });

  it("drops the muted divider when only muted rows match the search", async () => {
    const user = userEvent.setup();
    renderPlain({
      triggerStyle: "chip",
      selected: [],
      searchPlaceholder: "Search rarities…",
      mutedOptions: new Set(["rare", "epic"]),
    });

    await user.click(screen.getByRole("combobox"));
    await user.type(await screen.findByPlaceholderText("Search rarities…"), "epic");

    const list = screen.getByRole("listbox");
    expect(list.querySelectorAll('[data-slot="combobox-separator"]')).toHaveLength(0);
  });
});

function renderGrouped(onChange = vi.fn(), onToggleGroup = vi.fn()) {
  render(
    <MultiSelectCombobox
      triggerStyle="button"
      label="Variant"
      searchPlaceholder="Search variants…"
      primaryLabel="Art"
      options={[
        { value: "normal", label: "Normal" },
        { value: "alt", label: "Alt Art" },
      ]}
      selected={["alt"]}
      onChange={onChange}
      groups={[
        {
          label: "Finish",
          options: [
            { value: "normal", label: "Nonfoil" },
            { value: "foil", label: "Foil" },
          ],
          included: ["foil"],
          excluded: [],
          sign: "include",
          onSignedToggle: onToggleGroup,
          onSignFlip: vi.fn(),
        },
      ]}
    />,
  );
  return { onChange, onToggleGroup };
}

describe("MultiSelectCombobox sections", () => {
  it("heads each section and divides them", async () => {
    const user = userEvent.setup();
    renderGrouped();

    await user.click(screen.getByRole("combobox"));

    const list = await screen.findByRole("listbox");
    expect(within(list).getByText("Art")).toBeInTheDocument();
    expect(within(list).getByText("Finish")).toBeInTheDocument();
    expect(list.querySelectorAll('[data-slot="combobox-separator"]')).toHaveLength(1);
  });

  it("keeps a header only for sections with a matching row", async () => {
    const user = userEvent.setup();
    renderGrouped();

    await user.click(screen.getByRole("combobox"));
    await user.type(await screen.findByPlaceholderText("Search variants…"), "foil");

    const list = screen.getByRole("listbox");
    expect(within(list).queryByText("Art")).not.toBeInTheDocument();
    expect(within(list).getByText("Finish")).toBeInTheDocument();
    expect(list.querySelectorAll('[data-slot="combobox-separator"]')).toHaveLength(0);
  });

  it("keeps equal values in different sections apart", async () => {
    const user = userEvent.setup();
    const { onChange, onToggleGroup } = renderGrouped();

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Nonfoil" }));
    expect(onToggleGroup).toHaveBeenCalledExactlyOnceWith("normal", "include");
    expect(onChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole("option", { name: "Normal" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(["alt", "normal"]);
  });

  it("marks included and excluded rows and strikes the excluded label", async () => {
    const user = userEvent.setup();
    renderIncludeExclude(["ogn"], ["unl"]);

    await user.click(screen.getByRole("combobox"));

    const origins = await screen.findByRole("option", { name: "Origins" });
    expect(origins.querySelector("svg.lucide-check")).not.toBeNull();
    const unlimited = screen.getByRole("option", { name: "Unlimited" });
    expect(unlimited.querySelector("svg.lucide-minus")).not.toBeNull();
    expect(within(unlimited).getByText("Unlimited")).toHaveClass("line-through");
    const plain = screen.getByRole("option", { name: "Beyond the Rift" });
    expect(plain.querySelector("svg.lucide-check, svg.lucide-minus")).toBeNull();
  });

  it("summarises a section's selection next to the cycle buckets", () => {
    render(
      <MultiSelectCombobox
        triggerStyle="button"
        label="Variant"
        placeholder="Any"
        options={[{ value: "alt", label: "Alt Art" }]}
        selected={["alt"]}
        onChange={vi.fn()}
        groups={[
          {
            label: "Finish",
            options: [{ value: "foil", label: "Foil" }],
            included: [],
            excluded: ["foil"],
            sign: "exclude",
            onSignedToggle: vi.fn(),
            onSignFlip: vi.fn(),
          },
        ]}
      />,
    );
    expect(screen.getByRole("combobox")).toHaveTextContent("Alt Art, −Foil");
  });
});

describe("MultiSelectCombobox menu search threshold", () => {
  it("shows the search field above eight options", async () => {
    const user = userEvent.setup();
    renderInMenu();

    await user.click(screen.getByRole("button", { name: "More" }));
    await user.click(await screen.findByText("Markers"));

    const input = await screen.findByPlaceholderText("Search markers…");
    expect(input.closest("[data-slot=input-group]")).not.toHaveClass("sr-only");
  });

  it("names the menu row with its summary", async () => {
    const user = userEvent.setup();
    renderInMenu({ selected: ["judge"] });
    await user.click(screen.getByRole("button", { name: "More" }));
    expect(await screen.findByRole("combobox", { name: "Markers: Judge" })).toBeInTheDocument();
  });
});
