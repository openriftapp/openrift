import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ShareButton } from "./share-button";

const ICON = <svg aria-hidden="true" />;

describe("ShareButton", () => {
  it("renders a linking share as the anchor, not a button inside one", () => {
    const { container } = render(
      <ShareButton label="Star on GitHub" icon={ICON} href="https://example.test/repo" />,
    );

    expect(container.querySelector("a button")).toBeNull();
    expect(container.querySelectorAll("a")).toHaveLength(1);
  });

  it("points that anchor at the target, opened safely", () => {
    render(<ShareButton label="Star on GitHub" icon={ICON} href="https://example.test/repo" />);

    const link = screen.getByRole("link", { name: "Star on GitHub" });
    expect(link).toHaveAttribute("href", "https://example.test/repo");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });
});
