import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Disclosure } from "./disclosure";

describe("Disclosure", () => {
  it("toggles through an ExpandToggle and reports the open state", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Disclosure title="Source drift" onOpenChange={onOpenChange}>
        Drift rows
      </Disclosure>,
    );
    const trigger = screen.getByRole("button", { name: "Source drift" });
    expect(trigger.querySelector("svg.lucide-chevron-right")).not.toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    await user.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Drift rows")).toBeTruthy();
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("starts open with defaultOpen", () => {
    render(
      <Disclosure title="More" variant="plain" defaultOpen>
        Older entries
      </Disclosure>,
    );
    expect(screen.getByRole("button", { name: "More" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Older entries")).toBeTruthy();
  });

  it("renders the heading variant's trigger inside a section heading with its count", async () => {
    const user = userEvent.setup();
    render(
      <Disclosure variant="heading" title="Traded before" count={4}>
        Past partners
      </Disclosure>,
    );
    const heading = screen.getByRole("heading", { level: 3 });
    const trigger = screen.getByRole("button", { name: "Traded before 4" });
    expect(heading.contains(trigger)).toBe(true);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    await user.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Past partners")).toBeTruthy();
  });
});
