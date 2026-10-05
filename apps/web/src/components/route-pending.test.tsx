import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RoutePending } from "./route-pending";

describe("RoutePending", () => {
  it("announces loading and renders skeleton blocks", () => {
    const { container } = render(<RoutePending />);

    expect(screen.getByRole("status", { name: "Loading…" })).toBeTruthy();
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });
});
