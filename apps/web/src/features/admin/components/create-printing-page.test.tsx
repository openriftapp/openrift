import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { OrderedMultiSelect } from "./create-printing-page";

const OPTIONS = [
  { value: "event", label: "Event" },
  { value: "promo", label: "Promo" },
  { value: "store", label: "Store" },
];

function renderSelect(selected: string[], onChange = vi.fn(), options = OPTIONS) {
  render(
    <OrderedMultiSelect
      id="channels"
      options={options}
      selected={selected}
      onChange={onChange}
      placeholder="— select channels —"
      searchPlaceholder="Search channels…"
      emptyOptionsText="No channels defined"
    />,
  );
  return onChange;
}

describe("OrderedMultiSelect", () => {
  it("summarizes the selection in option order", () => {
    renderSelect(["store", "event"]);

    expect(screen.getByRole("combobox")).toHaveTextContent("Event, Store");
  });

  it("reports picks in option order", async () => {
    const user = userEvent.setup();
    const onChange = renderSelect(["store"]);

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Event" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith(["event", "store"]);
  });

  it("shows the empty text when there are no options", () => {
    renderSelect([], vi.fn(), []);

    expect(screen.getByText("No channels defined")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});
