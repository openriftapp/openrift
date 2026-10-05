import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ResponsiveDialog,
  ResponsiveDialogCancel,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "./responsive-dialog";

const isMobile = vi.hoisted(() => ({ value: false }));

vi.mock("@/hooks/use-is-mobile", () => ({
  useIsMobile: () => isMobile.value,
}));

function renderDialog(onOpenChange = vi.fn()) {
  render(
    <ResponsiveDialog open onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Pick a deck</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>Choose where the cards go.</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogFooter>
          <ResponsiveDialogCancel />
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>,
  );
  return onOpenChange;
}

describe("ResponsiveDialog", () => {
  beforeEach(() => {
    isMobile.value = false;
  });

  it("renders a centered dialog on desktop", () => {
    renderDialog();
    const dialog = screen.getByRole("dialog", { name: "Pick a deck" });
    expect(dialog.dataset.slot).toBe("dialog-content");
    expect(document.querySelector("[data-slot=drawer-popup]")).toBeNull();
  });

  it("renders a drawer on phones", () => {
    isMobile.value = true;
    renderDialog();
    expect(screen.getByText("Pick a deck").dataset.slot).toBe("drawer-title");
    expect(document.querySelector("[data-slot=drawer-popup]")).not.toBeNull();
    expect(document.querySelector("[data-slot=dialog-content]")).toBeNull();
  });

  it.each([false, true])("closes through Cancel (mobile: %s)", async (mobile) => {
    isMobile.value = mobile;
    const user = userEvent.setup();
    const onOpenChange = renderDialog();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
  });
});
