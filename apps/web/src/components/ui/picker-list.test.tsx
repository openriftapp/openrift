import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PickerGroup, PickerList, PickerRow } from "./picker-list";

function GroupedPicker({ initial }: { initial: string }) {
  const [highlighted, setHighlighted] = useState(initial);
  return (
    <PickerList highlightedId={highlighted} onHighlightChange={setHighlighted}>
      <PickerGroup label="Owned">
        <PickerRow value="a">Alpha</PickerRow>
        <PickerRow value="b">Beta</PickerRow>
      </PickerGroup>
      <PickerGroup label="Missing">
        <PickerRow value="c">Gamma</PickerRow>
        <PickerRow value="d">Delta</PickerRow>
      </PickerGroup>
    </PickerList>
  );
}

function rect(top: number, bottom: number): DOMRect {
  return { top, bottom, left: 0, right: 100, width: 100, height: bottom - top } as DOMRect;
}

describe("PickerList", () => {
  // cmdk's keyboard handling only works while focus lives inside the Command
  // root, so the picker must grab focus on mount. This replaced the `autoFocus`
  // DOM attribute (which scrolled the picker into view and jumped virtualized
  // grids); the focus must still land, just without the scroll.
  it("moves focus to the Command root on mount", () => {
    const { container } = render(
      <PickerList highlightedId="a" onHighlightChange={() => {}}>
        <PickerRow value="a">Alpha</PickerRow>
        <PickerRow value="b">Beta</PickerRow>
      </PickerList>,
    );
    const root = container.querySelector('[data-slot="command"]');
    expect(root).not.toBeNull();
    expect(document.activeElement).toBe(root);
  });

  it("moves focus to the filter input on mount when searchable", () => {
    const { container } = render(
      <PickerList searchPlaceholder="Filter…" highlightedId="a" onHighlightChange={() => {}}>
        <PickerRow value="a" keywords={["Alpha"]}>
          Alpha
        </PickerRow>
      </PickerList>,
    );
    const input = container.querySelector('[data-slot="command-input"]');
    expect(input).not.toBeNull();
    expect(document.activeElement).toBe(input);
  });

  it("keeps focus on the root inside a drawer so the phone keyboard stays closed", () => {
    const { container } = render(
      <div data-slot="drawer-content">
        <PickerList searchPlaceholder="Filter…" highlightedId="a" onHighlightChange={() => {}}>
          <PickerRow value="a" keywords={["Alpha"]}>
            Alpha
          </PickerRow>
        </PickerList>
      </div>,
    );
    expect(document.activeElement).toBe(container.querySelector('[data-slot="command"]'));
  });

  it("filters rows by keywords, case-insensitively", () => {
    render(
      <PickerList searchPlaceholder="Filter…" highlightedId="" onHighlightChange={() => {}}>
        <PickerRow value="id-a" keywords={["Alpha"]}>
          Alpha
        </PickerRow>
        <PickerRow value="id-b" keywords={["Beta"]}>
          Beta
        </PickerRow>
      </PickerList>,
    );
    fireEvent.change(screen.getByPlaceholderText("Filter…"), { target: { value: "alp" } });
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();
  });

  it("matches every word in any order across a row's keywords", () => {
    render(
      <PickerList searchPlaceholder="Filter…" highlightedId="" onHighlightChange={() => {}}>
        <PickerRow value="id-a" keywords={["Ahri, Alluring", "OGN-066"]}>
          Ahri
        </PickerRow>
        <PickerRow value="id-b" keywords={["Teemo, Scout", "OGN-100"]}>
          Teemo
        </PickerRow>
      </PickerList>,
    );
    fireEvent.change(screen.getByPlaceholderText("Filter…"), {
      target: { value: "alluring ahri" },
    });
    expect(screen.getByText("Ahri")).toBeInTheDocument();
    expect(screen.queryByText("Teemo")).not.toBeInTheDocument();
  });

  it("never matches the query against row values (opaque ids)", () => {
    render(
      <PickerList searchPlaceholder="Filter…" highlightedId="" onHighlightChange={() => {}}>
        <PickerRow value="id-a" keywords={["Alpha"]}>
          Alpha
        </PickerRow>
        <PickerRow value="id-b" keywords={["Beta"]}>
          Beta
        </PickerRow>
      </PickerList>,
    );
    fireEvent.change(screen.getByPlaceholderText("Filter…"), { target: { value: "id-" } });
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();
  });

  it("shows all rows again when the query is cleared", () => {
    render(
      <PickerList searchPlaceholder="Filter…" highlightedId="" onHighlightChange={() => {}}>
        <PickerRow value="id-a" keywords={["Alpha"]}>
          Alpha
        </PickerRow>
        <PickerRow value="id-b" keywords={["Beta"]}>
          Beta
        </PickerRow>
      </PickerList>,
    );
    const input = screen.getByPlaceholderText("Filter…");
    fireEvent.change(input, { target: { value: "beta" } });
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: "" } });
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("caps the list height by default and lets the caller override it", () => {
    const { container, rerender } = render(
      <PickerList highlightedId="" onHighlightChange={() => {}}>
        <PickerRow value="a">Alpha</PickerRow>
      </PickerList>,
    );
    const list = () => container.querySelector('[data-slot="command-list"]');
    expect(list()).toHaveClass("max-h-72");
    rerender(
      <PickerList highlightedId="" onHighlightChange={() => {}} listClassName="max-h-40">
        <PickerRow value="a">Alpha</PickerRow>
      </PickerList>,
    );
    expect(list()).toHaveClass("max-h-40");
    expect(list()).not.toHaveClass("max-h-72");
  });
});

describe("PickerRow", () => {
  it("marks a selected row with the shared selected style", () => {
    render(
      <PickerList highlightedId="" onHighlightChange={() => {}}>
        <PickerRow value="a" selected>
          Alpha
        </PickerRow>
        <PickerRow value="b">Beta</PickerRow>
      </PickerList>,
    );
    const alpha = screen.getByRole("option", { name: "Alpha" });
    const beta = screen.getByRole("option", { name: "Beta" });
    expect(alpha).toHaveAttribute("data-checked", "true");
    expect(alpha).toHaveClass("bg-primary/10");
    expect(beta).not.toHaveAttribute("data-checked");
    expect(beta).not.toHaveClass("bg-primary/10");
  });

  it("ignores clicks on a disabled row", () => {
    const onSelect = vi.fn();
    render(
      <PickerList highlightedId="" onHighlightChange={() => {}}>
        <PickerRow value="a" disabled onSelect={onSelect}>
          Alpha
        </PickerRow>
      </PickerList>,
    );
    const row = screen.getByRole("option", { name: "Alpha" });
    fireEvent.click(row);
    expect(onSelect).not.toHaveBeenCalled();
    expect(row).toHaveAttribute("aria-disabled", "true");
  });

  describe("keyboard scrolling", () => {
    const nativeScrollIntoView = Element.prototype.scrollIntoView;
    afterEach(() => {
      Element.prototype.scrollIntoView = nativeScrollIntoView;
    });

    it("never runs a native scrollIntoView, so moving onto a group's first row leaves the window alone", () => {
      const native = vi.fn();
      Element.prototype.scrollIntoView = native;
      const { container } = render(<GroupedPicker initial="b" />);
      const root = container.querySelector('[data-slot="command"]') as HTMLElement;

      fireEvent.keyDown(root, { key: "ArrowDown" });

      expect(screen.getByRole("option", { name: "Gamma" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(native).not.toHaveBeenCalled();
    });

    it("scrolls the list, heading included, when the keyboard lands on a group's first row above the fold", () => {
      Element.prototype.scrollIntoView = vi.fn();
      const { container } = render(<GroupedPicker initial="d" />);
      const root = container.querySelector('[data-slot="command"]') as HTMLElement;
      const list = container.querySelector("[cmdk-list]") as HTMLElement;
      list.scrollTop = 200;
      list.getBoundingClientRect = () => rect(100, 300);
      const gamma = screen.getByRole("option", { name: "Gamma" });
      gamma.getBoundingClientRect = () => rect(80, 110);
      const missingHeading = screen.getByText("Missing");
      missingHeading.getBoundingClientRect = () => rect(60, 80);

      fireEvent.keyDown(root, { key: "ArrowUp" });

      expect(gamma).toHaveAttribute("aria-selected", "true");
      expect(list.scrollTop).toBe(148);
    });

    it("leaves the list where it is when the pointer moves the highlight", () => {
      Element.prototype.scrollIntoView = vi.fn();
      const { container } = render(<GroupedPicker initial="a" />);
      const list = container.querySelector("[cmdk-list]") as HTMLElement;
      list.scrollTop = 0;
      list.getBoundingClientRect = () => rect(100, 300);
      const delta = screen.getByRole("option", { name: "Delta" });
      delta.getBoundingClientRect = () => rect(320, 350);

      fireEvent.pointerMove(delta);

      expect(delta).toHaveAttribute("aria-selected", "true");
      expect(list.scrollTop).toBe(0);
    });
  });
});
