import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SettingsGroup } from "./settings-group";

function renderGroup(props: { collapsible?: boolean; defaultCollapsed?: boolean }) {
  return render(
    <SettingsGroup id="group" title="Pairings" {...props}>
      <p>Body</p>
    </SettingsGroup>,
  );
}

describe("SettingsGroup", () => {
  it("renders a plain group title through SectionHeading", () => {
    const { container } = renderGroup({});
    const heading = screen.getByRole("heading", { name: "Pairings" });
    expect(heading.dataset.slot).toBe("section-heading");
    expect(container.querySelector("[data-slot=expand-toggle]")).toBeNull();
    expect(screen.getByText("Body")).toBeTruthy();
  });

  it("renders a collapsible group title through SectionHeading inside the toggle", () => {
    renderGroup({ collapsible: true });
    const toggle = screen.getByRole("button", { name: "Pairings" });
    expect(toggle.querySelector("[data-slot=section-heading]")?.textContent).toBe("Pairings");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });

  it("starts collapsed when defaultCollapsed is set and expands on click", () => {
    renderGroup({ collapsible: true, defaultCollapsed: true });
    const toggle = screen.getByRole("button", { name: "Pairings" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Body")).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Body")).toBeTruthy();
  });

  it("ignores defaultCollapsed without collapsible", () => {
    renderGroup({ defaultCollapsed: true });
    expect(screen.getByText("Body")).toBeTruthy();
  });
});
