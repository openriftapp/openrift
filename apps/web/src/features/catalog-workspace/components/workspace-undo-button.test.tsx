import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceUndoEntry } from "@/features/catalog-workspace/lib/workspace-undo";
import { useWorkspaceSelectionStore } from "@/features/catalog-workspace/stores/workspace-selection-store";
import { createStoreResetter } from "@/test/store-helpers";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn() }) }));

const { WorkspaceUndoButton } = await import("./workspace-undo-button");

let resetStore: () => void;

beforeEach(() => {
  resetStore = createStoreResetter(useWorkspaceSelectionStore);
});

afterEach(() => {
  resetStore();
});

function entry(label: string): WorkspaceUndoEntry {
  return {
    label,
    undoneLabel: `Undone: ${label}`,
    invalidates: [],
    undo: vi.fn(() => Promise.resolve()),
  };
}

function renderButton() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <WorkspaceUndoButton />
    </QueryClientProvider>,
  );
}

describe("WorkspaceUndoButton", () => {
  it("is absent while the stack is empty", () => {
    renderButton();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("names the newest entry with the Z hint and undoes it on click", async () => {
    const older = entry("Used Rarity from Provider A on Vi");
    const newer = entry("Discarded 1 image on Teemo, Scout");
    act(() => {
      useWorkspaceSelectionStore.getState().pushUndo(older);
      useWorkspaceSelectionStore.getState().pushUndo(newer);
    });
    renderButton();

    const button = screen.getByRole("button", {
      name: "Undo: Discarded 1 image on Teemo, Scout Z",
    });
    await userEvent.click(button);

    await vi.waitFor(() => expect(newer.undo).toHaveBeenCalledOnce());
    expect(older.undo).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("button", { name: "Undo: Used Rarity from Provider A on Vi Z" }),
    ).toBeTruthy();
  });

  it("is disabled while an undo is running", () => {
    act(() => {
      useWorkspaceSelectionStore.getState().pushUndo(entry("Ignored Ekko"));
      useWorkspaceSelectionStore.getState().setUndoing(true);
    });
    renderButton();
    expect(screen.getByRole("button", { name: "Undo: Ignored Ekko Z" })).toHaveProperty(
      "disabled",
      true,
    );
  });
});
