import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RowList, RowListItem, RowListLink } from "./row-list";

describe("RowListLink", () => {
  it("shows a focus ring for keyboard focus", () => {
    render(
      <RowList>
        <RowListItem>
          <RowListLink href="/meta">Summoner Skirmish</RowListLink>
        </RowListItem>
      </RowList>,
    );

    const link = screen.getByRole("link", { name: "Summoner Skirmish" });
    expect(link.className).toContain("focus-visible:ring-2");
    expect(link.className).toContain("outline-none");
  });
});
