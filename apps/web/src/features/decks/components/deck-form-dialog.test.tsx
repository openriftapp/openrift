import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";

import { DeckFormDialog, DeckFormFooter } from "./deck-form-dialog";

function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button onClick={() => setOpen((current) => !current)}>Toggle</Button>
      <DeckFormDialog open={open} onOpenChange={setOpen}>
        {({ onSavingChange }) => <Button onClick={() => onSavingChange(true)}>Start save</Button>}
      </DeckFormDialog>
    </>
  );
}

function SlowSaveHarness({ save }: { save: () => Promise<void> }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button onClick={() => setOpen((current) => !current)}>Toggle</Button>
      <DeckFormDialog open={open} onOpenChange={setOpen}>
        {({ onClose, onSavingChange }) => (
          <Button
            onClick={async () => {
              onSavingChange(true);
              await save();
              onSavingChange(false);
              onClose();
            }}
          >
            Save
          </Button>
        )}
      </DeckFormDialog>
    </>
  );
}

describe("DeckFormDialog", () => {
  it("leaves a reopened dialog open when the save from before it finishes", async () => {
    const user = userEvent.setup();
    let finishSave: (() => void) | undefined;
    const saveDone = new Promise<void>((resolve) => {
      finishSave = resolve;
    });
    render(<SlowSaveHarness save={() => saveDone} />);

    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Toggle", hidden: true }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await user.click(screen.getByRole("button", { name: "Toggle" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    await act(async () => {
      finishSave?.();
      await saveDone;
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes the dialog when its own save finishes", async () => {
    const user = userEvent.setup();
    render(<SlowSaveHarness save={() => Promise.resolve()} />);

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("offers Cancel in the shared footer, disabled while saving", () => {
    const { rerender } = render(
      <DeckFormDialog open onOpenChange={vi.fn()}>
        {() => <DeckFormFooter pending={false}>{null}</DeckFormFooter>}
      </DeckFormDialog>,
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    rerender(
      <DeckFormDialog open onOpenChange={vi.fn()}>
        {() => <DeckFormFooter pending>{null}</DeckFormFooter>}
      </DeckFormDialog>,
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("disables the close button while a save runs", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByRole("button", { name: "Close" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Start save" }));
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
  });

  it("keeps Escape working after the parent closed it during a save", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Start save" }));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Toggle", hidden: true }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await user.click(screen.getByRole("button", { name: "Toggle" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
