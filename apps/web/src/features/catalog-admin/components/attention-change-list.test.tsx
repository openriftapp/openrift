import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AttentionGroup } from "@/features/catalog-admin/lib/attention-items";

import { AttentionChangeList } from "./attention-change-list";

const cardGroup: AttentionGroup = {
  key: "card:c1",
  kind: "card",
  title: "Card",
  printingId: null,
  candidate: null,
  changes: [
    {
      key: "card:c1:name",
      field: "name",
      label: "Name",
      current: "Lux, Lady of Luminosity",
      proposed: "Lux, Lady of Light",
      kind: "value",
    },
    {
      key: "card:c1:might",
      field: "might",
      label: "Might",
      current: 3,
      proposed: 5,
      kind: "value",
    },
  ],
  unchangedFields: ["Domains"],
  summary: null,
};

const newPrintingGroup: AttentionGroup = {
  key: "new-printing:cp1",
  kind: "new-printing",
  title: "New printing OGN-042 · foil",
  printingId: null,
  candidate: null,
  changes: [],
  unchangedFields: [],
  summary: "foil · epic · Riot Artist",
};

const linkedPrintingGroup: AttentionGroup = {
  key: "printing:cp2",
  kind: "printing",
  title: "Printing OGN-001 · EN",
  printingId: "prt-1",
  candidate: null,
  changes: [
    {
      key: "printing:cp2:artist",
      field: "artist",
      label: "Artist",
      current: "Old Artist",
      proposed: "New Artist",
      kind: "value",
    },
  ],
  unchangedFields: [],
  summary: null,
};

const printingTargets = [
  { id: "prt-1", label: "OGN-001 · EN" },
  { id: "prt-2", label: "OGN-002 · EN" },
];

function renderList(overrides: Partial<React.ComponentProps<typeof AttentionChangeList>> = {}) {
  const onToggle = vi.fn();
  const onEdit = vi.fn();
  render(
    <AttentionChangeList
      groups={[cardGroup]}
      ticked={new Set(["card:c1:name", "card:c1:might"])}
      edits={new Map()}
      onToggle={onToggle}
      onEdit={onEdit}
      {...overrides}
    />,
  );
  return { onToggle, onEdit };
}

describe("AttentionChangeList", () => {
  it("shows the group header and one row per change", () => {
    renderList();
    expect(screen.getByText("Card")).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Might")).toBeInTheDocument();
    expect(screen.getByText("Lux, Lady of Light")).toBeInTheDocument();
  });

  it("reports a toggle by change key", async () => {
    const { onToggle } = renderList();
    await userEvent.click(screen.getByRole("checkbox", { name: "Might" }));
    expect(onToggle).toHaveBeenCalledWith("card:c1:might");
  });

  it("opens an inline editor from the pencil and reports the new value", async () => {
    const { onEdit } = renderList();
    await userEvent.click(screen.getByRole("button", { name: "Edit Name" }));
    const input = screen.getByDisplayValue("Lux, Lady of Light");
    await userEvent.type(input, "!");
    expect(onEdit).toHaveBeenCalledWith("card:c1:name", "Lux, Lady of Light!");
  });

  it("links a new printing straight from the menu", async () => {
    const onLinkGroup = vi.fn();
    renderList({
      groups: [newPrintingGroup],
      ticked: new Set(["new-printing:cp1"]),
      printingTargets,
      onLinkGroup,
    });
    await userEvent.click(screen.getByRole("button", { name: "Link to existing…" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "OGN-002 · EN" }));
    expect(onLinkGroup).toHaveBeenCalledWith(newPrintingGroup, "prt-2");
  });

  it("moves a linked printing group and leaves out its own printing", async () => {
    const onMoveGroup = vi.fn();
    renderList({
      groups: [linkedPrintingGroup],
      ticked: new Set(["printing:cp2:artist"]),
      printingTargets,
      onMoveGroup,
    });
    await userEvent.click(screen.getByRole("button", { name: "Move to another printing…" }));
    expect(await screen.findByRole("menuitem", { name: "OGN-002 · EN" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "OGN-001 · EN" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("menuitem", { name: "OGN-002 · EN" }));
    expect(onMoveGroup).toHaveBeenCalledWith(linkedPrintingGroup, "prt-2");
  });

  it("keeps the move control off a new-printing group", () => {
    renderList({
      groups: [newPrintingGroup],
      ticked: new Set(["new-printing:cp1"]),
      printingTargets,
      onMoveGroup: vi.fn(),
    });
    expect(
      screen.queryByRole("button", { name: "Move to another printing…" }),
    ).not.toBeInTheDocument();
  });

  it("hides the link control when no handler is given", () => {
    renderList({ groups: [newPrintingGroup], ticked: new Set(["new-printing:cp1"]) });
    expect(screen.queryByRole("button", { name: "Link to existing…" })).not.toBeInTheDocument();
  });

  it("marks an edited row and names the unchanged fields on demand", async () => {
    renderList({ edits: new Map([["card:c1:name", "Lux"]]) });
    expect(screen.getByText("You are editing the incoming value.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /1 field unchanged/u }));
    expect(screen.getByText("Domains")).toBeInTheDocument();
  });
});
