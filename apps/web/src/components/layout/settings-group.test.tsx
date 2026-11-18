import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SettingsGroup } from "./settings-group";

describe("SettingsGroup", () => {
  it("renders the title through SectionHeading with the body open", () => {
    render(
      <SettingsGroup id="group" title="Pairings">
        <p>Body</p>
      </SettingsGroup>,
    );
    const heading = screen.getByRole("heading", { name: "Pairings" });
    expect(heading.dataset.slot).toBe("section-heading");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Body")).toBeTruthy();
  });

  it("names the section by its heading", () => {
    render(
      <SettingsGroup id="group" title="Pairings">
        <p>Body</p>
      </SettingsGroup>,
    );
    expect(screen.getByRole("region", { name: "Pairings" })).toBeTruthy();
  });
});
