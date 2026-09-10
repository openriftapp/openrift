import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { VisibilityGroup } from "./group-visibility-section";
import { GroupVisibilitySection } from "./group-visibility-section";

const GROUPS: VisibilityGroup[] = [
  { id: "g1", slug: "allerlei", name: "Allerlei Spielerei" },
  { id: "g2", slug: "summoner-hall", name: "Summoner Hall" },
];

function renderSection(
  sharedIds: string[],
  overrides: { onShare?: () => void; onUnshare?: () => void } = {},
) {
  const onShare = vi.fn(overrides.onShare);
  const onUnshare = vi.fn(overrides.onUnshare);
  render(
    <GroupVisibilitySection
      groups={GROUPS}
      sharedGroupIds={new Set(sharedIds)}
      onShare={onShare}
      onUnshare={onUnshare}
      pending={false}
      description="Who can see this."
      emptyNote="No groups yet."
      idPrefix="test"
    />,
  );
  return { onShare, onUnshare };
}

describe("GroupVisibilitySection", () => {
  it("reads no shares as 'Only me'", () => {
    renderSection([]);
    expect(screen.getByRole("radio", { name: "Only me" })).toBeChecked();
  });

  it("reads every group shared as 'All my groups'", () => {
    renderSection(["g1", "g2"]);
    expect(screen.getByRole("radio", { name: "All my groups" })).toBeChecked();
  });

  it("reads a partial share as 'Some groups' and lists the groups", () => {
    renderSection(["g1"]);
    expect(screen.getByRole("radio", { name: "Some groups" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Allerlei Spielerei" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Summoner Hall" })).not.toBeChecked();
  });

  it("shares with every group not already shared when picking 'All my groups'", async () => {
    const user = userEvent.setup();
    const { onShare } = renderSection(["g1"]);
    await user.click(screen.getByRole("radio", { name: "All my groups" }));
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(onShare).toHaveBeenCalledWith(GROUPS[1]);
  });

  it("unshares every shared group when picking 'Only me'", async () => {
    const user = userEvent.setup();
    const { onUnshare } = renderSection(["g1", "g2"]);
    await user.click(screen.getByRole("radio", { name: "Only me" }));
    expect(onUnshare).toHaveBeenCalledTimes(2);
  });

  it("stays on 'Some groups' after unchecking the last one, instead of snapping to 'Only me'", async () => {
    const user = userEvent.setup();
    renderSection(["g1"]);
    await user.click(screen.getByRole("radio", { name: "Some groups" }));
    await user.click(screen.getByRole("checkbox", { name: "Allerlei Spielerei" }));
    expect(screen.getByRole("radio", { name: "Some groups" })).toBeChecked();
  });

  it("explains itself when the user is in no groups", () => {
    render(
      <GroupVisibilitySection
        groups={[]}
        sharedGroupIds={new Set()}
        onShare={vi.fn()}
        onUnshare={vi.fn()}
        pending={false}
        description="Who can see this."
        emptyNote="No groups yet."
        idPrefix="test"
      />,
    );
    expect(screen.getByText("No groups yet.")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});
