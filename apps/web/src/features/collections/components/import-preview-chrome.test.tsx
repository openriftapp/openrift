import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ImportRowsSection, ImportStatusBadges } from "./import-preview-chrome";

function rowList(surface?: "page" | "dialog"): HTMLElement {
  render(
    <ImportRowsSection title="Needs attention" surface={surface}>
      <div>Charm</div>
    </ImportRowsSection>,
  );
  const list = screen.getByText("Charm").parentElement;
  if (!list) {
    throw new Error("row list not rendered");
  }
  return list;
}

describe("ImportRowsSection", () => {
  it("keeps the rows inside the page gutter on a page", () => {
    const list = rowList("page");
    expect(list.className).not.toContain("-mx-4");
    expect(list.className).toContain("var(--gutter-left)");
  });

  it("bleeds the rows to a dialog's edges", () => {
    expect(rowList().className).toContain("-mx-4");
  });
});

describe("ImportStatusBadges", () => {
  it("uses the singular for one row that needs attention", () => {
    render(
      <ImportStatusBadges
        readyCount={0}
        toVerifyCount={0}
        needsAttentionCount={1}
        skippedCount={0}
      />,
    );
    expect(screen.getByText("1 needs attention")).toBeTruthy();
  });
});
