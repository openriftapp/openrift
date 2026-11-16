import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { acceptFieldWithUndo, revertAcceptedField } from "./accept-undo";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function undoAction(): () => void {
  const [, options] = vi.mocked(toast.success).mock.calls[0] as unknown as [
    string,
    { action: { onClick: () => void } },
  ];
  return options.action.onClick;
}

beforeEach(() => {
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});

describe("acceptFieldWithUndo", () => {
  it("toasts with Undo once the accept succeeds, and Undo writes the previous value", async () => {
    const accept = vi.fn(
      async (_input: { cardId: string; value: unknown; source?: "provider" | "manual" }) => ({
        written: true,
      }),
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
      async (_input: { cardId: string; value: unknown; source?: "provider" | "manual" }) => ({
        written: true,
      }),
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

  it("offers no undo when the API wrote nothing", async () => {
    const accept = vi.fn(async (_input: { value: unknown; source?: "provider" | "manual" }) => ({
      written: false,
    }));
    const onAccepted = vi.fn();

    const accepted = await acceptFieldWithUndo({
      accept,
      input: { value: "Rare", source: "provider" },
      fieldLabel: "Rarity",
      sourceLabel: "Provider A",
      previousValue: "Rare",
    });
    await acceptFieldWithUndo({
      accept,
      input: { value: "Rare", source: "provider" },
      fieldLabel: "Rarity",
      sourceLabel: "Provider A",
      previousValue: "Rare",
      onAccepted,
    });

    expect(accepted).toBe(true);
    expect(accept).toHaveBeenCalledTimes(2);
    expect(toast.success).not.toHaveBeenCalled();
    expect(onAccepted).not.toHaveBeenCalled();
  });

  it.each([
    ["the same list", "domains", ["fury", "calm"], ["fury", "calm"]],
    ["a reordered set", "markerSlugs", ["promo", "foil"], ["foil", "promo"]],
  ])("offers no undo after accepting %s", async (_case, field, value, previousValue) => {
    const onAccepted = vi.fn();

    await acceptFieldWithUndo({
      accept: vi.fn(
        async (_input: { field: string; value: unknown; source?: "provider" | "manual" }) => ({
          written: false,
        }),
      ),
      input: { field, value, source: "provider" },
      fieldLabel: "Domains",
      sourceLabel: "Provider A",
      previousValue,
      onAccepted,
    });

    expect(onAccepted).not.toHaveBeenCalled();
  });

  it.each([
    ["text over an empty string", "", null],
    ["a number over its text form", "4", 4],
  ])("offers undo when the API wrote %s", async (_case, previousValue, value) => {
    const accept = vi.fn(async (_input: { value: unknown; source?: "provider" | "manual" }) => ({
      written: true,
    }));
    const onAccepted = vi.fn();

    await acceptFieldWithUndo({
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

    expect(toast.success).toHaveBeenCalledOnce();
    expect(onAccepted).toHaveBeenCalledWith({ value: previousValue, source: "manual" });
  });

  it("makes a second accept on one field undo to the value the first one wrote", async () => {
    const gates: (() => void)[] = [];
    const accept = vi.fn(
      (_input: {
        printingId: string;
        field: string;
        value: unknown;
        source?: "provider" | "manual";
      }) =>
        new Promise<{ written: boolean }>((resolve) => {
          gates.push(() => resolve({ written: true }));
        }),
    );
    const reverts: unknown[] = [];
    const run = (value: string) =>
      acceptFieldWithUndo({
        accept,
        input: { printingId: "p-seq", field: "rarity", value, source: "provider" },
        fieldLabel: "Rarity",
        sourceLabel: "Provider A",
        previousValue: "common",
        onAccepted: (revert) => reverts.push(revert),
      });

    const first = run("rare");
    const second = run("epic");
    await vi.waitFor(() => expect(gates).toHaveLength(1));
    gates[0]?.();
    await first;
    await vi.waitFor(() => expect(gates).toHaveLength(2));
    gates[1]?.();
    await second;

    expect(reverts.map((revert) => (revert as { value: unknown }).value)).toEqual([
      "common",
      "rare",
    ]);
  });

  it("refuses to undo an accept while a later accept on the same field can still be undone", async () => {
    const accept = vi.fn(
      async (_input: {
        cardId: string;
        field: string;
        value: unknown;
        source?: "provider" | "manual";
      }) => ({
        written: true,
      }),
    );
    const reverts: { value: unknown }[] = [];
    for (const value of ["3", "4"]) {
      await acceptFieldWithUndo({
        accept,
        input: { cardId: "c-order", field: "might", value, source: "provider" },
        fieldLabel: "Might",
        sourceLabel: "Provider A",
        previousValue: "2",
        onAccepted: (revert) => reverts.push(revert),
      });
    }
    const write = vi.fn(async () => {});
    const [older, newer] = reverts;
    if (older === undefined || newer === undefined) {
      throw new Error("expected two reverts");
    }

    await expect(revertAcceptedField(older, write)).rejects.toThrow(
      "Undo the later change to this field first",
    );
    expect(write).not.toHaveBeenCalled();
    await revertAcceptedField(newer, write);
    await revertAcceptedField(older, write);
    expect(write.mock.calls).toEqual([[newer], [older]]);
  });

  it("lets the older accept be undone once the newer one's record is gone", async () => {
    const accept = vi.fn(
      async (_input: {
        cardId: string;
        field: string;
        value: unknown;
        source?: "provider" | "manual";
      }) => ({ written: true }),
    );
    const reverts: { value: unknown }[] = [];
    for (const value of ["3", "4"]) {
      await acceptFieldWithUndo({
        accept,
        input: { cardId: "c-gone", field: "might", value, source: "provider" },
        fieldLabel: "Might",
        sourceLabel: "Provider A",
        previousValue: "2",
        onAccepted: (revert) => reverts.push(revert),
      });
    }
    const [older, newer] = reverts;
    if (older === undefined || newer === undefined) {
      throw new Error("expected two reverts");
    }
    const gone = Object.assign(new Error("Card not found"), { status: 404 });

    await expect(revertAcceptedField(newer, () => Promise.reject(gone))).rejects.toBe(gone);
    const write = vi.fn(async () => {});
    await revertAcceptedField(older, write);
    expect(write).toHaveBeenCalledWith(older);
  });

  it("toasts the refusal when the older toast's Undo is clicked first", async () => {
    const accept = vi.fn(
      async (_input: {
        cardId: string;
        field: string;
        value: unknown;
        source?: "provider" | "manual";
      }) => ({ written: true }),
    );
    for (const value of ["3", "4"]) {
      await acceptFieldWithUndo({
        accept,
        input: { cardId: "c-toast", field: "might", value, source: "provider" },
        fieldLabel: "Might",
        sourceLabel: "Provider A",
        previousValue: "2",
      });
    }
    accept.mockClear();

    undoAction()();

    expect(toast.error).toHaveBeenCalledWith("Undo the later change to this field first");
    expect(accept).not.toHaveBeenCalled();
  });

  it("shows no success toast when the accept fails", async () => {
    const accept = vi.fn(async (_input: { value: unknown }): Promise<{ written: boolean }> => {
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
