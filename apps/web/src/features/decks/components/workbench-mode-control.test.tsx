import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorkbenchModeControl } from "./workbench-mode-control";

describe("WorkbenchModeControl", () => {
  it("names the modes Edit and View on desktop", () => {
    render(<WorkbenchModeControl mode="deck" isMobile={false} onModeChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Edit" })).toBeDefined();
    expect(screen.getByRole("button", { name: "View" })).toBeDefined();
  });

  it("switches to editing from the Edit item", () => {
    const onModeChange = vi.fn();
    render(<WorkbenchModeControl mode="deck" isMobile={false} onModeChange={onModeChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(onModeChange).toHaveBeenCalledWith("build");
  });
});
