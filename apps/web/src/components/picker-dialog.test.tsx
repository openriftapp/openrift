import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { PickerDialog, PickerSection } from "./picker-dialog";
import type { PickerCreate, PickerOption, PickerSectionProps } from "./picker-dialog";

const OPTIONS: PickerOption[] = [
  { value: "a", label: "Arcane binder", keywords: ["Arcane binder"], group: "wish" },
  { value: "b", label: "Bandle box", keywords: ["Bandle box"], group: "trade", meta: "Cards" },
];

function renderDialog(
  props: Partial<
    Pick<PickerSectionProps, "options" | "groups" | "searchPlaceholder" | "noMatchesText">
  > & { onPick?: (value: string) => void; create?: PickerCreate } = {},
) {
  return render(
    <PickerDialog
      open
      onOpenChange={() => {}}
      title="Pick a list"
      options={OPTIONS}
      emptyText="No lists yet."
      {...props}
      onPick={props.onPick ?? vi.fn()}
    />,
  );
}

describe("PickerDialog", () => {
  it("acts on the pick itself when there is no confirm", () => {
    const onPick = vi.fn();
    renderDialog({ onPick });

    expect(screen.queryByRole("button", { name: "Move" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: /Bandle box/u }));

    expect(onPick).toHaveBeenCalledWith("b");
  });

  it("selects a row and confirms it with the confirm button", () => {
    const onConfirm = vi.fn();
    render(
      <PickerDialog
        open
        onOpenChange={() => {}}
        title="Pick a list"
        options={OPTIONS}
        emptyText="No lists yet."
        confirm={{ label: "Move", pendingLabel: "Moving…", onConfirm }}
      />,
    );
    const confirm = screen.getByRole("button", { name: "Move" });
    expect(confirm).toBeDisabled();

    const row = screen.getByRole("option", { name: /Arcane binder/u });
    fireEvent.click(row);
    expect(row).toHaveAttribute("data-checked", "true");
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith("a");
  });

  it("labels and disables the confirm button per selected row", () => {
    const onConfirm = vi.fn();
    render(
      <PickerDialog
        open
        onOpenChange={() => {}}
        title="Pick a list"
        options={OPTIONS}
        emptyText="No lists yet."
        confirm={{
          label: (selected) => (selected === null ? "Pick one" : `Move to ${selected}`),
          pendingLabel: "Moving…",
          disabledFor: (selected) => selected === "b",
          onConfirm,
        }}
      />,
    );
    expect(screen.getByRole("button", { name: "Pick one" })).toBeDisabled();

    fireEvent.click(screen.getByRole("option", { name: /Bandle box/u }));
    const blocked = screen.getByRole("button", { name: "Move to b" });
    expect(blocked).toBeDisabled();
    fireEvent.submit(blocked.closest("form")!);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("option", { name: /Arcane binder/u }));
    fireEvent.click(screen.getByRole("button", { name: "Move to a" }));
    expect(onConfirm).toHaveBeenCalledWith("a");
  });

  it("shows the pending label and blocks rows while pending", () => {
    const onConfirm = vi.fn();
    render(
      <PickerDialog
        open
        onOpenChange={() => {}}
        title="Pick a list"
        options={OPTIONS}
        emptyText="No lists yet."
        pending
        confirm={{ label: "Move", pendingLabel: "Moving…", onConfirm }}
      />,
    );
    expect(screen.getByRole("button", { name: "Moving…" })).toBeDisabled();
    expect(screen.getByRole("option", { name: /Arcane binder/u })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("forgets the selection when reopened", () => {
    const dialog = (open: boolean) => (
      <PickerDialog
        open={open}
        onOpenChange={() => {}}
        title="Pick a list"
        options={OPTIONS}
        emptyText="No lists yet."
        confirm={{ label: "Move", pendingLabel: "Moving…", onConfirm: vi.fn() }}
      />
    );
    const view = render(dialog(true));
    fireEvent.click(screen.getByRole("option", { name: /Arcane binder/u }));
    expect(screen.getByRole("button", { name: "Move" })).toBeEnabled();

    view.rerender(dialog(false));
    view.rerender(dialog(true));

    expect(screen.getByRole("button", { name: "Move" })).toBeDisabled();
  });

  it("shows the empty state when there are no options", () => {
    renderDialog({ options: [] });

    expect(screen.getByText("No lists yet.")).toBeInTheDocument();
    expect(document.querySelector('[data-slot="picker-row"]')).toBeNull();
  });

  it("filters rows and shows the no-matches text", () => {
    renderDialog({ searchPlaceholder: "Filter lists…", noMatchesText: "Nothing matches." });

    fireEvent.change(screen.getByPlaceholderText("Filter lists…"), {
      target: { value: "zzz" },
    });

    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(screen.getByText("Nothing matches.")).toBeInTheDocument();
  });

  it("puts grouped rows under their headings", () => {
    renderDialog({
      groups: [
        { key: "wish", label: "Wishlists" },
        { key: "trade", label: "Tradelists" },
      ],
    });

    expect(screen.getByText("Wishlists")).toBeInTheDocument();
    expect(screen.getByText("Tradelists")).toBeInTheDocument();
    expect(screen.getByText("Cards")).toBeInTheDocument();
  });

  it("runs a plain create action on click", () => {
    const onClick = vi.fn();
    renderDialog({ create: { actions: [{ key: "wish", label: "New wishlist", onClick }] } });

    fireEvent.click(screen.getByRole("button", { name: "New wishlist" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("opens a name field for a create action and hands over the trimmed name", () => {
    const onCreate = vi.fn((_key: string, _name: string, done: () => void) => done());
    renderDialog({
      options: [],
      create: {
        actions: [{ key: "trade", label: "New tradelist", placeholder: "Tradelist name" }],
        onCreate,
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "New tradelist" }));
    expect(screen.queryByText("No lists yet.")).not.toBeInTheDocument();
    const create = screen.getByRole("button", { name: "Create" });
    expect(create).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Tradelist name"), {
      target: { value: "  Summoner Skirmish  " },
    });
    fireEvent.click(create);

    expect(onCreate).toHaveBeenCalledWith("trade", "Summoner Skirmish", expect.any(Function));
    expect(screen.queryByPlaceholderText("Tradelist name")).not.toBeInTheDocument();
    expect(screen.getByText("No lists yet.")).toBeInTheDocument();
  });
});

function MultiSection() {
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set(["a"]));
  const toggle = (value: string) => {
    const next = new Set(checked);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    setChecked(next);
  };
  return (
    <PickerSection
      hint="Pick copies"
      options={OPTIONS}
      checked={checked}
      onPick={toggle}
      emptyText="None"
    />
  );
}

describe("PickerSection multiple selection", () => {
  it("draws a checkbox per row that follows the checked set", () => {
    render(<MultiSection />);

    const checkboxes = document.querySelectorAll('[data-slot="checkbox"]');
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0]).toHaveAttribute("data-checked");
    expect(checkboxes[1]).not.toHaveAttribute("data-checked");
  });

  it("toggles a row once per click", () => {
    render(<MultiSection />);
    const row = screen.getByRole("option", { name: /Bandle box/u });

    fireEvent.click(row);
    expect(row).toHaveAttribute("data-checked", "true");

    fireEvent.click(row);
    expect(row).not.toHaveAttribute("data-checked");
  });

  it("toggles the highlighted row once per Enter", () => {
    render(<MultiSection />);
    const root = document.querySelector<HTMLElement>('[data-slot="command"]');
    if (!root) {
      throw new Error("No command root rendered");
    }
    fireEvent.keyDown(root, { key: "ArrowDown" });
    const row = screen.getByRole("option", { selected: true });
    const wasChecked = Object.hasOwn((row as HTMLElement).dataset, "checked");

    fireEvent.keyDown(root, { key: "Enter" });

    expect(Object.hasOwn((row as HTMLElement).dataset, "checked")).toBe(!wasChecked);
  });
});
