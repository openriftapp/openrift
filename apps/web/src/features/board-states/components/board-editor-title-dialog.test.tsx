import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BoardEditorTitleDialog } from "./board-editor-title-dialog";

function dialog(open: boolean) {
  return (
    <BoardEditorTitleDialog
      title="Who wins the lane?"
      open={open}
      onOpenChange={vi.fn()}
      onTitle={vi.fn()}
    />
  );
}

describe("BoardEditorTitleDialog", () => {
  it("starts from the current title again when the parent reopens it", async () => {
    const { rerender } = render(dialog(true));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Abandoned" } });

    rerender(dialog(false));
    rerender(dialog(true));

    expect(await screen.findByRole("textbox")).toHaveValue("Who wins the lane?");
  });
});
