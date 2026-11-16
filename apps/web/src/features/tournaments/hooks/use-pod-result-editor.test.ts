import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { usePodResultEditor } from "./use-pod-result-editor";

const submission = { results: [{ playerId: "p1", gamePoints: 2 }], drawnGames: 0 };

describe("usePodResultEditor", () => {
  it("closes the form and reports the saved result after a successful save", async () => {
    const save = vi.fn(async () => {});
    const onSaved = vi.fn();
    const { result } = renderHook(() => usePodResultEditor(save, onSaved));

    act(() => result.current.handleStart());
    expect(result.current.editing).toBe(true);

    await act(() => result.current.submit(submission));
    expect(save).toHaveBeenCalledWith(submission);
    expect(onSaved).toHaveBeenCalledWith(submission);
    expect(result.current.editing).toBe(false);
    expect(result.current.saving).toBe(false);
  });

  it("keeps the form open with the error when the save fails", async () => {
    const failure = new Error("offline");
    const onSaved = vi.fn();
    const { result } = renderHook(() =>
      usePodResultEditor(async () => {
        throw failure;
      }, onSaved),
    );

    act(() => result.current.handleStart());
    await act(() => result.current.submit(submission));
    expect(result.current.editing).toBe(true);
    expect(result.current.error).toBe(failure);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("clears an earlier error when the form opens again", async () => {
    const { result } = renderHook(() =>
      usePodResultEditor(async () => {
        throw new Error("offline");
      }),
    );

    await act(() => result.current.submit(submission));
    expect(result.current.error).not.toBeNull();
    act(() => result.current.handleStart());
    expect(result.current.error).toBeNull();
  });

  it("runs another save on the same pod through the shared state", async () => {
    const { result } = renderHook(() => usePodResultEditor(async () => {}));
    let ok = false;
    await act(async () => {
      ok = await result.current.run(async () => {});
    });
    expect(ok).toBe(true);
    expect(result.current.editing).toBe(false);
  });
});
