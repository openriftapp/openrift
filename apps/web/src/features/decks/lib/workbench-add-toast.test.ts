import { beforeEach, describe, expect, it, vi } from "vitest";

interface ToastButton {
  label: string;
  onClick: () => void;
}

interface ToastOptions {
  action?: ToastButton;
  cancel?: ToastButton;
}

const mocks = vi.hoisted(() => {
  const toast = Object.assign(
    vi.fn((_message: string, _options?: ToastOptions) => "swap-toast"),
    {
      warning: vi.fn((_message: string, _options?: ToastOptions) => "warning-toast"),
      dismiss: vi.fn(),
    },
  );
  return { toast };
});

vi.mock("sonner", () => ({ toast: mocks.toast }));

// oxlint-disable-next-line import/first -- must import after vi.mock
import { stubDeckBuilderCard } from "@/test/factories";

// oxlint-disable-next-line import/first -- must import after vi.mock
import {
  dismissRelaxedAddToasts,
  dismissRemovalToast,
  relaxedAddMessage,
  showRelaxedAddToast,
  showRemovalToast,
} from "./workbench-add-toast";

const scorcher = stubDeckBuilderCard({ cardName: "Blazing Scorcher" });

beforeEach(() => {
  mocks.toast.mockClear();
  mocks.toast.warning.mockClear();
  mocks.toast.dismiss.mockClear();
});

describe("relaxedAddMessage", () => {
  it("names the card and the limit for an over-limit copy", () => {
    expect(
      relaxedAddMessage({
        rule: "copyLimit",
        card: scorcher,
        zone: "main",
        quantity: 1,
        total: 4,
        limit: 3,
      }),
    ).toBe("Added Blazing Scorcher: 4 copies, over the 3-copy limit.");
  });

  it("counts battlefields against their cap", () => {
    expect(
      relaxedAddMessage({
        rule: "battlefieldCap",
        card: scorcher,
        zone: "main",
        quantity: 1,
        total: 4,
        limit: 3,
      }),
    ).toBe("4 battlefields, limit 3.");
  });

  it("names both runes of a swap", () => {
    const fury = stubDeckBuilderCard({ cardName: "Fury Rune" });
    const calm = stubDeckBuilderCard({ cardName: "Calm Rune" });
    expect(
      relaxedAddMessage({
        rule: "runeSwap",
        card: fury,
        zone: "runes",
        quantity: 1,
        total: 12,
        limit: 12,
        swappedOut: calm,
      }),
    ).toBe("+1 Fury Rune, −1 Calm Rune");
  });
});

describe("showRelaxedAddToast", () => {
  it("warns with an Undo action for a broken rule", () => {
    const undo = vi.fn();
    showRelaxedAddToast(
      { rule: "copyLimit", card: scorcher, zone: "main", quantity: 1, total: 4, limit: 3 },
      { undo },
    );
    expect(mocks.toast.warning).toHaveBeenCalledOnce();
    const [, options] = mocks.toast.warning.mock.calls[0] ?? [];
    options?.action?.onClick();
    expect(undo).toHaveBeenCalledOnce();
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("offers Keep both with the 13-rune total on a swap", () => {
    const keepBoth = vi.fn();
    const rune = stubDeckBuilderCard({ cardName: "Fury Rune" });
    showRelaxedAddToast(
      {
        rule: "runeSwap",
        card: rune,
        zone: "runes",
        quantity: 1,
        total: 12,
        limit: 12,
        swappedOut: rune,
      },
      { undo: vi.fn(), keepBoth },
    );
    expect(mocks.toast.warning).not.toHaveBeenCalled();
    const [, options] = mocks.toast.mock.calls[0] ?? [];
    expect(options?.cancel?.label).toBe("Keep both (13)");
    options?.cancel?.onClick();
    expect(keepBoth).toHaveBeenCalledOnce();
  });

  it("leaves out Keep both when no handler is given", () => {
    const rune = stubDeckBuilderCard({ cardName: "Fury Rune" });
    showRelaxedAddToast(
      {
        rule: "runeSwap",
        card: rune,
        zone: "runes",
        quantity: 1,
        total: 12,
        limit: 12,
        swappedOut: rune,
      },
      { undo: vi.fn() },
    );
    const [, options] = mocks.toast.mock.calls[0] ?? [];
    expect(options?.cancel).toBeUndefined();
  });
});

describe("dismissRelaxedAddToasts", () => {
  it("dismisses the toasts still open and forgets them", () => {
    showRelaxedAddToast(
      { rule: "copyLimit", card: scorcher, zone: "main", quantity: 1, total: 4, limit: 3 },
      { undo: vi.fn() },
    );
    dismissRelaxedAddToasts();
    expect(mocks.toast.dismiss).toHaveBeenCalledWith("warning-toast");
    mocks.toast.dismiss.mockClear();
    dismissRelaxedAddToasts();
    expect(mocks.toast.dismiss).not.toHaveBeenCalled();
  });
});

describe("showRemovalToast", () => {
  it("offers an undo that runs the given handler", () => {
    const undo = vi.fn();
    showRemovalToast("Removed Blazing Scorcher from Main Deck.", undo);
    const options = mocks.toast.mock.calls[0]?.[1];
    expect(options?.action?.label).toBe("Undo");
    options?.action?.onClick();
    expect(undo).toHaveBeenCalledOnce();
    dismissRemovalToast();
  });

  it("is dismissed by the next edit, and only while it is open", () => {
    showRemovalToast("Removed Blazing Scorcher from Main Deck.", vi.fn());
    dismissRemovalToast();
    expect(mocks.toast.dismiss).toHaveBeenCalledWith("deck-removal");

    mocks.toast.dismiss.mockClear();
    dismissRemovalToast();
    expect(mocks.toast.dismiss).not.toHaveBeenCalled();
  });
});
