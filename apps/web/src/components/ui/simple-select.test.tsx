import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SimpleSelect } from "./simple-select";

const ITEMS = [
  { value: "day", label: "Day" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year", detail: 3 },
] as const;

describe("SimpleSelect", () => {
  it("names the trigger and shows the selected label", () => {
    render(
      <SimpleSelect items={ITEMS} value="month" onChange={() => undefined} label="Precision" />,
    );

    expect(screen.getByRole("combobox", { name: "Precision" })).toHaveTextContent("Month");
  });

  it("shows the placeholder without a value", () => {
    render(
      <SimpleSelect
        items={ITEMS}
        value={null}
        onChange={() => undefined}
        label="Precision"
        placeholder="Pick one"
      />,
    );

    expect(screen.getByRole("combobox", { name: "Precision" })).toHaveTextContent("Pick one");
  });

  it("reports the picked value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SimpleSelect items={ITEMS} value="day" onChange={onChange} label="Precision" />);

    await user.click(screen.getByRole("combobox", { name: "Precision" }));
    await user.click(await screen.findByRole("option", { name: /Year/u }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith("year");
  });

  it("defers the accessible name to aria-labelledby", () => {
    render(
      <>
        <span id="lbl">Release precision</span>
        <SimpleSelect
          items={ITEMS}
          value="day"
          onChange={() => undefined}
          label="ignored"
          aria-labelledby="lbl"
        />
      </>,
    );

    expect(screen.getByRole("combobox", { name: "Release precision" })).toBeInTheDocument();
  });

  it("renders the trigger through renderValue", () => {
    render(
      <SimpleSelect
        items={ITEMS}
        value="year"
        onChange={() => undefined}
        label="Precision"
        renderValue={(item) =>
          `${item.label} (${typeof item.detail === "number" ? item.detail : "none"})`
        }
      />,
    );

    expect(screen.getByRole("combobox", { name: "Precision" })).toHaveTextContent("Year (3)");
  });

  it("renders grouped items under their headings in group order", async () => {
    const user = userEvent.setup();
    render(
      <SimpleSelect
        items={[
          { value: "ogn", label: "Origins", group: "main" },
          { value: "arc", label: "Arcane Box Set", group: "extra" },
          { value: "all", label: "All sets" },
        ]}
        groups={[
          { key: "main", label: "Main sets" },
          { key: "extra", label: "Supplemental" },
        ]}
        value="all"
        onChange={() => undefined}
        label="Set"
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Set" }));
    const options = await screen.findAllByRole("option");

    expect(options.map((option) => option.textContent)).toEqual([
      "All sets",
      "Origins",
      "Arcane Box Set",
    ]);
    expect(screen.getByText("Supplemental")).toBeInTheDocument();
  });

  it("shows rich content in the row and the trigger", () => {
    render(
      <SimpleSelect
        items={[{ value: "grid", label: "Grid", content: <span>Grid · beta</span> }]}
        value="grid"
        onChange={() => undefined}
        label="Layout"
      />,
    );

    expect(screen.getByRole("combobox", { name: "Layout" })).toHaveTextContent("Grid · beta");
  });

  it("sets lang on an option and reports open changes", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <SimpleSelect
        items={[
          { value: "en", label: "English", lang: "en" },
          { value: "fr", label: "Français", lang: "fr" },
        ]}
        value="en"
        onChange={() => undefined}
        label="Language"
        onOpenChange={onOpenChange}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Language" }));

    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(await screen.findByRole("option", { name: "Français" })).toHaveAttribute("lang", "fr");
  });
});
