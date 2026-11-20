import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { copyPendingText, copyTextToClipboard, useCopyToClipboard } from "./use-copy-to-clipboard";

const writeText = vi.fn<(text: string) => Promise<void>>();

beforeEach(() => {
  writeText.mockReset();
  writeText.mockResolvedValue();
  Object.defineProperty(globalThis.navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("copyPendingText", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("writes through writeText where the browser has no ClipboardItem", async () => {
    vi.stubGlobal("ClipboardItem", undefined);

    await expect(copyPendingText(Promise.resolve("DECKCODE"))).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("DECKCODE");
  });

  it("hands the clipboard a pending item inside the click, before the text arrives", async () => {
    class StubClipboardItem {
      readonly data: Record<string, Promise<Blob>>;
      constructor(data: Record<string, Promise<Blob>>) {
        this.data = data;
      }
    }
    const write = vi.fn<(items: StubClipboardItem[]) => Promise<void>>().mockResolvedValue();
    vi.stubGlobal("ClipboardItem", StubClipboardItem);
    Object.defineProperty(globalThis.navigator, "clipboard", {
      value: { writeText, write },
      configurable: true,
    });
    let resolveText: (text: string) => void = () => undefined;
    const text = new Promise<string>((resolve) => {
      resolveText = resolve;
    });

    const copied = copyPendingText(text);
    expect(write).toHaveBeenCalledTimes(1);
    resolveText("Main: 3 Yasuo");

    await expect(copied).resolves.toBe(true);
    const blob = await write.mock.calls[0]?.[0][0]?.data["text/plain"];
    await expect(blob?.text()).resolves.toBe("Main: 3 Yasuo");
  });

  it("returns false when the text fails to arrive", async () => {
    vi.stubGlobal("ClipboardItem", undefined);

    await expect(copyPendingText(Promise.reject(new Error("offline")))).resolves.toBe(false);
    expect(writeText).not.toHaveBeenCalled();
  });

  it("returns false when the clipboard refuses the write", async () => {
    vi.stubGlobal("ClipboardItem", undefined);
    writeText.mockRejectedValue(new Error("NotAllowedError"));

    await expect(copyPendingText(Promise.resolve("DECKCODE"))).resolves.toBe(false);
  });
});

describe("copyTextToClipboard", () => {
  it("writes the text to the clipboard", async () => {
    await copyTextToClipboard("https://openrift.app/groups/join?code=ABC123");

    expect(writeText).toHaveBeenCalledWith("https://openrift.app/groups/join?code=ABC123");
  });

  it("writes an empty string rather than skipping the call", async () => {
    await copyTextToClipboard("");

    expect(writeText).toHaveBeenCalledWith("");
  });

  it("rejects when the write is denied, so callers can show their own error", async () => {
    writeText.mockRejectedValue(new Error("NotAllowedError"));

    await expect(copyTextToClipboard("link")).rejects.toThrow("NotAllowedError");
  });
});

describe("useCopyToClipboard", () => {
  it("writes the text and raises the copied flag", async () => {
    const { result } = renderHook(() => useCopyToClipboard());
    expect(result.current.copied).toBe(false);

    await act(async () => {
      await result.current.copy("https://openrift.app/lists/share/abc");
    });

    expect(writeText).toHaveBeenCalledWith("https://openrift.app/lists/share/abc");
    expect(result.current.copied).toBe(true);
  });

  it("clears the copied flag after the reset delay", async () => {
    // No `shouldAdvanceTime`: it ticks the clock from real time on top of what the
    // test advances, so the 1ms left below could elapse on its own under load.
    vi.useFakeTimers();
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy("link");
    });
    expect(result.current.copied).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(1499);
    });
    expect(result.current.copied).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.copied).toBe(false);
  });

  it("restarts the window when copied again before it elapses", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy("link");
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    await act(async () => {
      await result.current.copy("link");
    });
    // The first timer would have fired here had it not been cancelled.
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.copied).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.copied).toBe(false);
  });

  it("reports a denied write without raising the flag or throwing", async () => {
    writeText.mockRejectedValue(new Error("NotAllowedError"));
    const { result } = renderHook(() => useCopyToClipboard());

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.copy("link");
    });

    expect(outcome).toBe(false);
    expect(result.current.copied).toBe(false);
  });

  it("reports a successful write", async () => {
    const { result } = renderHook(() => useCopyToClipboard());

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.copy("link");
    });

    expect(outcome).toBe(true);
  });

  it("clears the flag immediately on reset", async () => {
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy("link");
    });
    expect(result.current.copied).toBe(true);

    act(() => {
      result.current.reset();
    });
    expect(result.current.copied).toBe(false);
  });

  it("cancels the pending window on reset so it cannot re-clear later", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy("link");
    });
    act(() => {
      result.current.reset();
    });

    // Copy again inside the first window: the cancelled timer must not fire and
    // clear this second confirmation early.
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    await act(async () => {
      await result.current.copy("link");
    });
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.copied).toBe(true);
  });

  it("is a no-op when nothing was copied", () => {
    const { result } = renderHook(() => useCopyToClipboard());

    act(() => {
      result.current.reset();
    });
    expect(result.current.copied).toBe(false);
  });

  it("does not update state after unmount", async () => {
    // waitFor polls on a real interval, so it never settles under a clock
    // that only the test moves.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const errors: unknown[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...args) => errors.push(args));
    const { result, unmount } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy("link");
    });
    unmount();
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    await waitFor(() => expect(errors).toHaveLength(0));
    spy.mockRestore();
  });
});
