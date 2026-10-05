import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmActionButton, ConfirmActionDialog } from "./confirm-action-dialog";

function renderDialog(props: { confirmPhrase?: string; isPending?: boolean } = {}) {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <ConfirmActionDialog
      open
      onOpenChange={onOpenChange}
      title="Delete Jinx Aggro?"
      description="The deck is removed."
      confirmLabel="Delete"
      onConfirm={onConfirm}
      {...props}
    />,
  );
  return { onConfirm, onOpenChange };
}

describe("ConfirmActionDialog", () => {
  it("confirms through the action and closes through Cancel", async () => {
    const user = userEvent.setup();
    const { onConfirm, onOpenChange } = renderDialog();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps the action disabled until the confirm phrase matches", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog({ confirmPhrase: "reset" });
    const action = screen.getByRole("button", { name: "Delete" });
    expect(action).toHaveProperty("disabled", true);

    const input = screen.getByRole("textbox", { name: 'Type "reset" to confirm' });
    await user.type(input, "rese{Enter}");
    expect(onConfirm).not.toHaveBeenCalled();

    await user.type(input, "T {Enter}");
    expect(action).toHaveProperty("disabled", false);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("disables both buttons while pending", () => {
    renderDialog({ isPending: true });
    expect(screen.getByRole("button", { name: "Delete" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveProperty("disabled", true);
  });
});

describe("ConfirmActionButton", () => {
  function renderButton(onConfirm: () => Promise<unknown>) {
    render(
      <ConfirmActionButton
        title="Clear the cache?"
        description="Every entry is dropped."
        confirmLabel="Clear"
        pendingLabel="Clearing…"
        onConfirm={onConfirm}
      >
        Clear cache
      </ConfirmActionButton>,
    );
  }

  it("shows the pending label and closes once the action resolves", async () => {
    const user = userEvent.setup();
    let finish: () => void = () => {};
    const onConfirm = vi.fn(
      () =>
        // oxlint-disable-next-line promise/avoid-new -- holds the action open to observe the pending state
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    renderButton(onConfirm);

    await user.click(screen.getByRole("button", { name: "Clear cache" }));
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByRole("button", { name: "Clearing…" })).toHaveProperty("disabled", true);

    finish();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("stays open and re-enables the action when the action rejects", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn(() => Promise.reject(new Error("boom")));
    renderButton(onConfirm);

    await user.click(screen.getByRole("button", { name: "Clear cache" }));
    await user.click(screen.getByRole("button", { name: "Clear" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Clear" })).toHaveProperty("disabled", false),
    );
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });
});
