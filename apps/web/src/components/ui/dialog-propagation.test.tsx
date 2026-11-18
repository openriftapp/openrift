import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AlertDialog, AlertDialogAction, AlertDialogContent } from "./alert-dialog";
import { Dialog, DialogContent } from "./dialog";

/**
 * The app hydrates on document, so React's root listener sees clicks on portaled nodes.
 * Mounting on document.body reproduces that.
 */
function mountOnBody(): HTMLDivElement {
  const root = document.createElement("div");
  document.body.append(root);
  return root;
}

describe("dialog click isolation", () => {
  it.each([
    {
      kind: "Dialog",
      label: "confirm",
      dialog: (onAction: () => void) => (
        <Dialog defaultOpen>
          <DialogContent showCloseButton={false}>
            <button type="button" onClick={onAction}>
              confirm
            </button>
          </DialogContent>
        </Dialog>
      ),
    },
    {
      kind: "AlertDialog",
      label: "Delete",
      dialog: (onAction: () => void) => (
        <AlertDialog defaultOpen>
          <AlertDialogContent>
            <AlertDialogAction onClick={onAction}>Delete</AlertDialogAction>
          </AlertDialogContent>
        </AlertDialog>
      ),
    },
  ])(
    "runs the $kind button's handler without bubbling to a clickable ancestor",
    async ({ label, dialog }) => {
      const user = userEvent.setup();
      const ancestorClick = vi.fn();
      const onAction = vi.fn();
      render(
        // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- stand-in for a clickable <Link> ancestor
        <div onClick={ancestorClick}>{dialog(onAction)}</div>,
        { container: mountOnBody() },
      );

      await user.click(screen.getByRole("button", { name: label }));

      expect(onAction).toHaveBeenCalledTimes(1);
      expect(ancestorClick).not.toHaveBeenCalled();
    },
  );
});
