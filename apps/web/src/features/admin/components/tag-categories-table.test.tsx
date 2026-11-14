import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TagCategoriesTable } from "./tag-categories-table";

const region = {
  id: "cat-1",
  slug: "region",
  label: "Region",
  description: "Where the champion hails from",
  tagCount: 4,
};

function renderTable(overrides: Partial<Parameters<typeof TagCategoriesTable>[0]> = {}) {
  const props = {
    categories: [region],
    slugExample: "region",
    labelExample: "Region",
    emptyText: "No categories yet",
    description: "Groups tags into sections.",
    onCreate: vi.fn().mockResolvedValue(undefined),
    onUpdate: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  render(<TagCategoriesTable {...props} />);
  return props;
}

describe("TagCategoriesTable", () => {
  it("lists categories with their tag count and the page description", () => {
    renderTable();

    expect(screen.getByText("Region")).toBeInTheDocument();
    expect(screen.getByText("Where the champion hails from")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Groups tags into sections.")).toBeInTheDocument();
  });

  it("shows the empty text without categories", () => {
    renderTable({ categories: [] });

    expect(screen.getByText("No categories yet")).toBeInTheDocument();
  });

  it("refuses to add a category without a label", async () => {
    const user = userEvent.setup();
    const props = renderTable();

    await user.click(screen.getByRole("button", { name: "Add Category" }));
    await user.type(screen.getByPlaceholderText("region"), "bandle");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Slug and label are required")).toBeInTheDocument();
    expect(props.onCreate).not.toHaveBeenCalled();
  });

  it("refuses a slug that is not kebab-case and names the example", async () => {
    const user = userEvent.setup();
    const props = renderTable({ slugExample: "species", labelExample: "Species" });

    await user.click(screen.getByRole("button", { name: "Add Category" }));
    await user.type(screen.getByPlaceholderText("species"), "yordle_kin");
    await user.type(screen.getByPlaceholderText("Species"), "Yordle kin");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Slug must be kebab-case (e.g. species)")).toBeInTheDocument();
    expect(props.onCreate).not.toHaveBeenCalled();
  });

  it("adds a trimmed category and saves an empty description as null", async () => {
    const user = userEvent.setup();
    const props = renderTable();

    await user.click(screen.getByRole("button", { name: "Add Category" }));
    await user.type(screen.getByPlaceholderText("region"), "Bandle-City");
    await user.type(screen.getByPlaceholderText("Region"), "  Bandle City ");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(props.onCreate).toHaveBeenCalledWith({
      slug: "bandle-city",
      label: "Bandle City",
      description: null,
    });
  });

  it("shows the label placeholder on add only", async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.queryByPlaceholderText("Region")).toBeNull();
    expect(screen.getByDisplayValue("Region")).toBeInTheDocument();
  });

  it("sends trimmed fields on edit and a cleared description as null", async () => {
    const user = userEvent.setup();
    const props = renderTable();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    const label = screen.getByDisplayValue("Region");
    await user.clear(label);
    await user.type(label, " Runeterra region ");
    await user.clear(screen.getByDisplayValue("Where the champion hails from"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(props.onUpdate).toHaveBeenCalledWith({
      id: "cat-1",
      slug: "region",
      label: "Runeterra region",
      description: null,
    });
  });
});
