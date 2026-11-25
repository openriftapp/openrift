import { ORPCError } from "@orpc/client";
import { defaultSerovalPlugins, makeSerovalPlugin } from "@tanstack/router-core/ssr/client";
import { fromCrossJSON, toCrossJSONAsync } from "seroval";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { statusErrorAdapter } from "@/lib/server-fns/status-error-adapter";

import {
  acceptFieldWithUndo,
  isFieldChangedError,
  markFieldAccept,
  revertAcceptedField,
} from "./accept-undo";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("isFieldChangedError", () => {
  const plugins = [makeSerovalPlugin(statusErrorAdapter), ...defaultSerovalPlugins];

  it("recognizes the API's refusal after it crosses the server-function boundary", async () => {
    const refusal = new ORPCError("FIELD_CHANGED", { status: 409, message: "Changed since" });
    const json = await toCrossJSONAsync(refusal, { refs: new Map(), plugins });

    expect(isFieldChangedError(fromCrossJSON(json, { refs: new Map(), plugins }))).toBe(true);
  });

  it("does not take another conflict for it", () => {
    expect(isFieldChangedError(new ORPCError("CONFLICT", { status: 409 }))).toBe(false);
  });
});

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
    expect(accept).toHaveBeenLastCalledWith({
      cardId: "c1",
      value: null,
      source: "manual",
      expected: "new",
    });
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

    expect(onAccepted).toHaveBeenCalledWith({
      cardId: "c1",
      value: "old",
      source: "manual",
      expected: "new",
    });
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
  ])("offers undo when the API wrote %s", async (label, previousValue, value) => {
    const accept = vi.fn(
      async (_input: { field: string; value: unknown; source?: "provider" | "manual" }) => ({
        written: true,
      }),
    );
    const onAccepted = vi.fn();

    await acceptFieldWithUndo({
      accept,
      input: { field: `toast-${label}`, value, source: "provider" },
      fieldLabel: "Rarity",
      sourceLabel: "Provider A",
      previousValue,
    });
    await acceptFieldWithUndo({
      accept,
      input: { field: `callback-${label}`, value, source: "provider" },
      fieldLabel: "Rarity",
      sourceLabel: "Provider A",
      previousValue,
      onAccepted,
    });

    expect(toast.success).toHaveBeenCalledOnce();
    expect(onAccepted).toHaveBeenCalledWith({
      field: `callback-${label}`,
      value: previousValue,
      source: "manual",
      expected: value,
    });
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

  it("undoes a queued accept to the value the accept ahead of it wrote", async () => {
    const accept = vi.fn(
      async (_input: {
        printingId: string;
        field: string;
        value: unknown;
        source?: "provider" | "manual";
      }) => ({ written: true }),
    );
    const reverts: { value: unknown }[] = [];
    const marks = [markFieldAccept(), markFieldAccept()];
    for (const [index, value] of ["rare", "epic"].entries()) {
      await acceptFieldWithUndo({
        accept,
        input: { printingId: "p-queued", field: "rarity", value, source: "provider" },
        fieldLabel: "Rarity",
        sourceLabel: "Provider A",
        previousValue: "common",
        mark: marks[index],
        onAccepted: (revert) => reverts.push(revert),
      });
    }

    expect(reverts.map((revert) => revert.value)).toEqual(["common", "rare"]);
  });

  it("undoes to the value on screen when the field went back to it after the earlier accept", async () => {
    const accept = vi.fn(
      async (_input: {
        printingId: string;
        field: string;
        value: unknown;
        source?: "provider" | "manual";
      }) => ({ written: true }),
    );
    const reverts: { value: unknown }[] = [];
    for (const value of ["rare", "epic"]) {
      await acceptFieldWithUndo({
        accept,
        input: { printingId: "p-reset", field: "rarity", value, source: "provider" },
        fieldLabel: "Rarity",
        sourceLabel: "Provider A",
        previousValue: "common",
        mark: markFieldAccept(),
        onAccepted: (revert) => reverts.push(revert),
      });
    }

    expect(reverts.map((revert) => revert.value)).toEqual(["common", "common"]);
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

  it.each([
    ["drops", "the field changed since", { status: 409, code: "FIELD_CHANGED" }, true],
    ["keeps", "the write hit another conflict", { status: 409, code: "CONFLICT" }, false],
  ])("%s the undo when %s", async (_verb, _case, shape, dropped) => {
    const accept = vi.fn(async (_input: { cardId: string; field: string; value: unknown }) => ({
      written: true,
    }));
    const reverts: { value: unknown }[] = [];
    for (const value of ["3", "4"]) {
      await acceptFieldWithUndo({
        accept,
        input: { cardId: `c-${shape.code}`, field: "might", value },
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
    const refusal = Object.assign(new Error("Changed since, not undone"), shape);

    await expect(revertAcceptedField(newer, () => Promise.reject(refusal))).rejects.toThrow(
      "Changed since, not undone",
    );
    const write = vi.fn(async () => {});
    const olderUndo = revertAcceptedField(older, write);
    await (dropped
      ? expect(olderUndo).resolves.toBeUndefined()
      : expect(olderUndo).rejects.toThrow());
    expect(write).toHaveBeenCalledTimes(dropped ? 1 : 0);
  });

  it("sends the value the accept wrote as the undo's expected value", async () => {
    const accept = vi.fn(async (_input: { cardId: string; field: string; value: unknown }) => ({
      written: true,
    }));
    const onAccepted = vi.fn();

    await acceptFieldWithUndo({
      accept,
      input: { cardId: "c-exp", field: "comment", value: null },
      fieldLabel: "Comment",
      sourceLabel: "Provider A",
      previousValue: "Errata pending",
      onAccepted,
    });

    expect(onAccepted).toHaveBeenCalledWith(
      expect.objectContaining({ value: "Errata pending", expected: null }),
    );
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
