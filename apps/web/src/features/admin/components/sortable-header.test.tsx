import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SortHeaderButton, ariaSort } from "./sortable-header";

describe("ariaSort", () => {
  it("announces an ascending column", () => {
    expect(ariaSort("asc")).toBe("ascending");
  });

  it("announces a descending column", () => {
    expect(ariaSort("desc")).toBe("descending");
  });

  it("announces a sortable column no one has sorted yet", () => {
    expect(ariaSort(false)).toBe("none");
  });
});

describe("SortHeaderButton", () => {
  it("gives a sortable column a control rather than plain text", () => {
    render(<SortHeaderButton sorted={false}>Card</SortHeaderButton>);
    expect(screen.getByRole("button", { name: "Card" })).toBeInTheDocument();
  });

  it("sorts on a click", async () => {
    const user = userEvent.setup();
    const toggle = vi.fn();
    render(
      <SortHeaderButton sorted={false} onClick={toggle}>
        Card
      </SortHeaderButton>,
    );

    await user.click(screen.getByRole("button", { name: "Card" }));

    expect(toggle).toHaveBeenCalled();
  });

  it("sorts from the keyboard, so the header is not mouse-only", async () => {
    const user = userEvent.setup();
    const toggle = vi.fn();
    render(
      <SortHeaderButton sorted={false} onClick={toggle}>
        Card
      </SortHeaderButton>,
    );

    await user.tab();
    await user.keyboard("{Enter}");

    expect(toggle).toHaveBeenCalled();
  });
});
