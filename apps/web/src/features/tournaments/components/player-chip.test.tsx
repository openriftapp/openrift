import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PlayerChip } from "./player-chip";

vi.mock("@/features/tournaments/hooks/use-region-label", () => ({
  useRegionLabel: () => (slug: string) => slug.toUpperCase(),
}));

describe("PlayerChip", () => {
  it("shows the name with initials when there is no photo", () => {
    render(<PlayerChip name="Ezreal Lux" />);
    expect(screen.getByText("Ezreal Lux")).toBeInTheDocument();
    expect(screen.getByText("EL")).toBeInTheDocument();
  });

  it("labels the region through the region tags", () => {
    render(<PlayerChip name="Ezreal" region="emea" />);
    expect(screen.getByText("EMEA")).toBeInTheDocument();
  });

  it("leaves the region badge off when no region is passed", () => {
    render(<PlayerChip name="Ezreal" region={null} />);
    expect(screen.queryByText("EMEA")).not.toBeInTheDocument();
  });

  it("marks a dropped player", () => {
    render(<PlayerChip name="Ezreal" dropped />);
    expect(screen.getByText("(dropped)")).toBeInTheDocument();
  });

  it("renders trailing content after the name", () => {
    render(
      <PlayerChip name="Ezreal">
        <span>extra</span>
      </PlayerChip>,
    );
    expect(screen.getByText("extra")).toBeInTheDocument();
  });
});
