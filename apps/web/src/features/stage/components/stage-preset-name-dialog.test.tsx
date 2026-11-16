import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StagePresetNameDialog } from "./stage-preset-name-dialog";

function dialog(open: boolean) {
  return (
    <StagePresetNameDialog
      open={open}
      onOpenChange={vi.fn()}
      title="Save preset"
      description="Name it"
      confirmLabel="Save"
      initialName="Summoner Skirmish"
      pending={false}
      onConfirm={vi.fn()}
    />
  );
}

describe("StagePresetNameDialog", () => {
  it("starts from the initial name again when the parent reopens it", async () => {
    const { rerender } = render(dialog(true));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Abandoned" } });

    rerender(dialog(false));
    rerender(dialog(true));

    expect(await screen.findByRole("textbox")).toHaveValue("Summoner Skirmish");
  });
});
