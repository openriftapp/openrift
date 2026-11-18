import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SettingsSection } from "./settings-section";

describe("SettingsSection", () => {
  it("is a region named by its title", () => {
    render(
      <SettingsSection title="Marketplaces">
        <p>Pick a marketplace</p>
      </SettingsSection>,
    );

    expect(screen.getByRole("region", { name: "Marketplaces" })).toHaveTextContent(
      "Pick a marketplace",
    );
  });
});
