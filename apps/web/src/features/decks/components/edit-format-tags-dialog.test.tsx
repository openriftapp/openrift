import { WellKnown } from "@openrift/shared/well-known";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { save, setArrayFilter } = vi.hoisted(() => ({
  save: vi.fn<(vars: unknown) => Promise<void>>(),
  setArrayFilter: vi.fn(),
}));

vi.mock("@/features/decks/hooks/use-decks", async () => {
  const { useMutation } = await import("@tanstack/react-query");
  return {
    useUpdateDeck: (meta?: Record<string, unknown>) => useMutation({ mutationFn: save, meta }),
  };
});

vi.mock("@/features/cards/hooks/use-card-filters", () => ({
  useFilterActions: () => ({ setArrayFilter }),
}));

vi.mock("@/features/decks/components/format-tag-multi-select", () => ({
  TagMultiSelect: () => null,
}));

const { EditFormatTagsDialog } = await import("./edit-format-tags-dialog");

function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <EditFormatTagsDialog
      deckId="deck-1"
      format={WellKnown.deckFormat.CUSTOM_REGION}
      currentSlugs={["piltover", "zaun"]}
      open={open}
      onOpenChange={setOpen}
    />
  );
}

async function saveTags() {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Harness />
    </QueryClientProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Save" }));
}

describe("EditFormatTagsDialog", () => {
  beforeEach(() => {
    save.mockReset();
    setArrayFilter.mockReset();
  });

  it("closes and applies the tags as a filter once the save resolves", async () => {
    save.mockResolvedValue();
    await saveTags();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(save.mock.calls[0]?.[0]).toEqual({
      deckId: "deck-1",
      formatConfig: { tagSlugs: ["piltover", "zaun"] },
    });
    expect(setArrayFilter).toHaveBeenCalledWith("customTags", ["piltover", "zaun"]);
  });

  it("stays open with an inline error and no filter change when the save fails", async () => {
    save.mockRejectedValue(new TypeError("Failed to fetch"));
    await saveTags();
    expect(
      await screen.findByText("Can't reach the server. Check your connection."),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(setArrayFilter).not.toHaveBeenCalled();
  });
});
