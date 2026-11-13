import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { stubCopy, stubPrinting } from "@/test/factories";

vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({ labels: { graders: {}, conditions: {} } }),
}));

const { AnnotatedDisposeDialog } = await import("./annotated-dispose-dialog");

function renderDialog(isPending: boolean) {
  const onCancel = vi.fn();
  const onConfirm = vi.fn();
  render(
    <AnnotatedDisposeDialog
      pending={{ copy: stubCopy({ isAltered: true }), printing: stubPrinting() }}
      onConfirm={onConfirm}
      onCancel={onCancel}
      isPending={isPending}
    />,
  );
  return { onCancel, onConfirm };
}

describe("AnnotatedDisposeDialog", () => {
  it("cannot be dismissed while the removal is pending", async () => {
    const user = userEvent.setup();
    const { onCancel } = renderDialog(true);
    await screen.findByRole("alertdialog");
    await user.keyboard("{Escape}");
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("cancels on Escape when idle", async () => {
    const user = userEvent.setup();
    const { onCancel } = renderDialog(false);
    await screen.findByRole("alertdialog");
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
