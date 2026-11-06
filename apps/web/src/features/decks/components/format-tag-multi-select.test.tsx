import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TagMultiSelect } from "./format-tag-multi-select";

const TAGS = [
  { slug: "demacia", label: "Demacia", category: "region", sortOrder: 0 },
  { slug: "noxus", label: "Noxus", category: "region", sortOrder: 1 },
  { slug: "ionia", label: "Ionia", category: "region", sortOrder: 2 },
];

vi.mock("@/hooks/use-enums", () => ({
  useCustomTagList: () => ({ all: TAGS, byCategory: new Map([["region", TAGS]]) }),
}));

describe("TagMultiSelect", () => {
  it("shows the placeholder with nothing picked", () => {
    render(
      <TagMultiSelect
        category="region"
        nounPlural="regions"
        selected={[]}
        onChange={() => undefined}
        triggerId="regions"
      />,
    );

    expect(screen.getByRole("combobox")).toHaveTextContent("Pick regions…");
  });

  it("joins picked tags with a comma in tag order", () => {
    render(
      <TagMultiSelect
        category="region"
        nounPlural="regions"
        selected={["ionia", "demacia"]}
        onChange={() => undefined}
        triggerId="regions"
      />,
    );

    expect(screen.getByRole("combobox")).toHaveTextContent("Demacia, Ionia");
  });

  it("adds a tag picked from the list", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TagMultiSelect
        category="region"
        nounPlural="regions"
        selected={["demacia"]}
        onChange={onChange}
        triggerId="regions"
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Noxus" }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith(["demacia", "noxus"]);
  });

  it("filters by the search field and shows the empty text", async () => {
    const user = userEvent.setup();
    render(
      <TagMultiSelect
        category="region"
        nounPlural="regions"
        selected={[]}
        onChange={() => undefined}
        triggerId="regions"
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.type(await screen.findByPlaceholderText("Search regions…"), "zaun");

    expect(screen.getByText("No matching regions.")).toBeInTheDocument();
  });
});
