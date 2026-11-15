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

  it.each([
    ["the same text", "Rare", "Rare"],
    ["the same number", 4, 4],
    ["an empty field cleared again", undefined, null],
  ])("offers no undo after accepting %s", async (_case, previousValue, value) => {
    const accept = vi.fn(async (_input: { value: unknown; source?: "provider" | "manual" }) => {});
    const onAccepted = vi.fn();

    const accepted = await acceptFieldWithUndo({
      accept,
      input: { value, source: "provider" },
      fieldLabel: "Rarity",
      sourceLabel: "Provider A",
      previousValue,
    });
    await acceptFieldWithUndo({
      accept,
      input: { value, source: "provider" },
      fieldLabel: "Rarity",
      sourceLabel: "Provider A",
      previousValue,
      onAccepted,
    });

    expect(accepted).toBe(true);
    expect(accept).toHaveBeenCalledTimes(2);
    expect(toast.success).not.toHaveBeenCalled();
    expect(onAccepted).not.toHaveBeenCalled();
  });

  it.each([
    ["the same list", "domains", ["fury", "calm"], ["fury", "calm"], false],
    ["a reordered list", "domains", ["calm", "fury"], ["fury", "calm"], true],
    ["a reordered set", "markerSlugs", ["promo", "foil"], ["foil", "promo"], false],
  ])("after accepting %s offers undo: %s", async (_case, field, value, previousValue, offered) => {
    const onAccepted = vi.fn();

    await acceptFieldWithUndo({
      accept: vi.fn(
        async (_input: { field: string; value: unknown; source?: "provider" | "manual" }) => {},
      ),
      input: { field, value, source: "provider" },
      fieldLabel: "Domains",
      sourceLabel: "Provider A",
      previousValue,
      onAccepted,
    });

    expect(onAccepted).toHaveBeenCalledTimes(offered ? 1 : 0);
  });

  it("offers undo for a release date even when the day matches", async () => {
    const onAccepted = vi.fn();
    const release = { releasedAt: "2025-10-31", releasePrecision: "day" };

    await acceptFieldWithUndo({
      accept: vi.fn(async (_input: { value: unknown; source?: "provider" | "manual" }) => {}),
      input: { value: release, source: "provider" },
      fieldLabel: "Released",
      sourceLabel: "Provider A",
      previousValue: { ...release, releasePrecision: "month" },
      onAccepted,
    });

    expect(onAccepted).toHaveBeenCalledOnce();
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
