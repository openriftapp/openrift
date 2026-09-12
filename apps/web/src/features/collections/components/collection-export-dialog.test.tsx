import type { CopyResponse } from "@openrift/shared/types/api/collection";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StackedEntry } from "@/features/collections/lib/stacked-entry";
import { stubCopy, stubPrinting } from "@/test/factories";

const yasuo = stubPrinting({ id: "p-yasuo", cardId: "card-yasuo", card: { name: "Yasuo" } });
const jinx = stubPrinting({ id: "p-jinx", cardId: "card-jinx", card: { name: "Jinx" } });

vi.mock("@/lib/auth-session", () => ({
  useRequiredUserId: () => "user-1",
}));

vi.mock("@/features/cards/hooks/use-cards", () => ({
  useCards: () => ({
    allPrintings: [yasuo, jinx],
    printingsById: { [yasuo.id]: yasuo, [jinx.id]: jinx },
    sets: [],
  }),
}));

vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({
    labels: { rarities: {}, conditions: {}, graders: {} },
  }),
}));

let queryResult: { data: CopyResponse[]; isReady: boolean } = {
  data: [],
  isReady: true,
};

vi.mock("@/features/collections/hooks/use-copies", () => ({
  useCopies: () => queryResult,
}));

const toastSuccess = vi.fn();
vi.mock("sonner", () => ({ toast: { success: (...args: unknown[]) => toastSuccess(...args) } }));

const { CollectionExportDialog } = await import("./collection-export-dialog");

const YASUO_STACK: StackedEntry = {
  printingId: yasuo.id,
  printing: yasuo,
  copyIds: ["c-1", "c-2"],
};
const JINX_STACK: StackedEntry = { printingId: jinx.id, printing: jinx, copyIds: ["c-3"] };

let downloadedBlobs: Blob[] = [];

function setup(
  overrides: {
    stacks?: StackedEntry[];
    selectableCopyIds?: string[];
    hasActiveFilters?: boolean;
  } = {},
) {
  const stacks = overrides.stacks ?? [YASUO_STACK, JINX_STACK];
  render(
    <CollectionExportDialog
      collectionName="Main binder"
      stacks={stacks}
      selectableCopyIds={overrides.selectableCopyIds ?? stacks.flatMap((stack) => stack.copyIds)}
      hasActiveFilters={overrides.hasActiveFilters ?? false}
      open
      onOpenChange={vi.fn()}
    />,
  );
}

const filterCheckbox = (label: string) => screen.getByRole("checkbox", { name: label });

describe("CollectionExportDialog", () => {
  beforeEach(() => {
    queryResult = { data: [], isReady: true };
    toastSuccess.mockReset();
    downloadedBlobs = [];
    vi.stubGlobal(
      "URL",
      Object.assign(globalThis.URL, {
        createObjectURL: vi.fn((blob: Blob) => {
          downloadedBlobs.push(blob);
          return "blob:fake";
        }),
        revokeObjectURL: vi.fn(),
      }),
    );
  });

  it("shows the title and counts every copy in the collection", () => {
    setup();

    expect(screen.getByRole("heading", { name: "Export collection" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export 3 copies" })).toBeEnabled();
  });

  it("disables Export while the copies are still loading", () => {
    queryResult = { data: [], isReady: false };
    setup();

    expect(screen.getByRole("button", { name: "Loading…" })).toBeDisabled();
  });

  it("disables Export when the collection has no copies", () => {
    setup({ stacks: [] });

    expect(screen.getByRole("button", { name: /export/iu })).toBeDisabled();
  });

  it("offers no filter toggle when no filters are active", () => {
    setup();

    expect(screen.queryByRole("checkbox", { name: /current filters/u })).not.toBeInTheDocument();
  });

  it("defaults to the filtered subset when filters are active", () => {
    setup({ hasActiveFilters: true, selectableCopyIds: ["c-3"] });

    expect(filterCheckbox("Only cards matching the current filters (1 of 3)")).toBeChecked();
    expect(screen.getByRole("button", { name: "Export 1 copy" })).toBeInTheDocument();
  });

  it("falls back to the whole collection when the filter scope is unchecked", async () => {
    const user = userEvent.setup();
    setup({ hasActiveFilters: true, selectableCopyIds: ["c-3"] });

    await user.click(filterCheckbox("Only cards matching the current filters (1 of 3)"));

    expect(screen.getByRole("button", { name: "Export 3 copies" })).toBeInTheDocument();
  });

  it("scopes the Cardmarket wants block to the filtered subset too", () => {
    setup({ hasActiveFilters: true, selectableCopyIds: ["c-3"] });

    const wants = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(wants.value).toBe("1x Jinx");
  });

  it("aggregates Cardmarket wants by card name", () => {
    setup();

    const wants = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(wants.value).toBe("1x Jinx\n2x Yasuo");
  });

  it("links to Cardmarket's wants page beside the wants block", () => {
    setup();

    expect(screen.getByRole("link", { name: "Open Cardmarket" })).toHaveAttribute(
      "href",
      "https://www.cardmarket.com/en/Riftbound/Wants",
    );
  });

  it("offers a text list that merges printings into one line per card", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByText("OpenRift CSV"));
    await user.click(await screen.findByRole("option", { name: "Text list" }));

    const preview = screen.getAllByRole("textbox")[0] as HTMLTextAreaElement;
    expect(preview.value).toBe("2 Yasuo\n1 Jinx");
    expect(screen.queryByRole("button", { name: /export \d/iu })).not.toBeInTheDocument();
  });

  it("writes copy metadata into the CSV", async () => {
    const user = userEvent.setup();
    queryResult = {
      data: [
        stubCopy({ id: "c-1", printingId: yasuo.id, condition: "near-mint" }),
        stubCopy({ id: "c-2", printingId: yasuo.id, condition: "played" }),
        stubCopy({ id: "c-3", printingId: jinx.id, condition: "near-mint" }),
      ],
      isReady: true,
    };
    setup();

    await user.click(screen.getByRole("button", { name: "Export 3 copies" }));

    expect(toastSuccess).toHaveBeenCalledWith("Collection exported.");
    const csv = await downloadedBlobs[0]!.text();
    expect(csv).toContain("near-mint");
    expect(csv).toContain("played");
  });
});
