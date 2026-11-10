import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { acceptFieldWithUndo } from "./accept-undo";

vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

function undoAction(): () => void {
  const [, options] = vi.mocked(toast.success).mock.calls[0] as unknown as [
    string,
    { action: { onClick: () => void } },
  ];
  return options.action.onClick;
}

beforeEach(() => {
  vi.mocked(toast.success).mockClear();
});

describe("acceptFieldWithUndo", () => {
  it("toasts with Undo once the accept succeeds, and Undo writes the previous value", async () => {
    const accept = vi.fn(
      async (_input: { cardId: string; value: unknown; source?: "provider" | "manual" }) => {},
    );

    const accepted = await acceptFieldWithUndo({
      accept,
      input: { cardId: "c1", value: "new", source: "provider" },
      fieldLabel: "Rarity",
      sourceLabel: "Provider A",
      previousValue: undefined,
    });

    expect(accepted).toBe(true);
    expect(toast.success).toHaveBeenCalledWith("Used Rarity from Provider A", expect.anything());
    undoAction()();
    expect(accept).toHaveBeenLastCalledWith({ cardId: "c1", value: null, source: "manual" });
  });

  it("hands the revert input to onAccepted and skips its own toast", async () => {
    const accept = vi.fn(
      async (_input: { cardId: string; value: unknown; source?: "provider" | "manual" }) => {},
    );
    const onAccepted = vi.fn();

    await acceptFieldWithUndo({
      accept,
      input: { cardId: "c1", value: "new", source: "provider" },
      fieldLabel: "Rarity",
      sourceLabel: "Provider A",
      previousValue: "old",
      onAccepted,
    });

    expect(onAccepted).toHaveBeenCalledWith({ cardId: "c1", value: "old", source: "manual" });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("shows no success toast when the accept fails", async () => {
    const accept = vi.fn(async (_input: { value: unknown }) => {
      throw new Error("conflict");
    });

    const accepted = await acceptFieldWithUndo({
      accept,
      input: { value: "new" },
      fieldLabel: "Rarity",
      sourceLabel: "Provider A",
      previousValue: "old",
    });

    expect(accepted).toBe(false);
    expect(toast.success).not.toHaveBeenCalled();
    expect(accept).toHaveBeenCalledOnce();
  });
});
