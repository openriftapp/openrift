import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useShiftHeld } from "./use-shift-held";

function press(type: "keydown" | "keyup", key: string) {
  act(() => {
    globalThis.dispatchEvent(new KeyboardEvent(type, { key }));
  });
}

describe("useShiftHeld", () => {
  it("starts released", () => {
    const { result } = renderHook(() => useShiftHeld());
    expect(result.current).toBe(false);
  });

  it("is held between Shift keydown and keyup", () => {
    const { result } = renderHook(() => useShiftHeld());
    press("keydown", "Shift");
    expect(result.current).toBe(true);
    press("keyup", "Shift");
    expect(result.current).toBe(false);
  });

  it("ignores other keys", () => {
    const { result } = renderHook(() => useShiftHeld());
    press("keydown", "a");
    expect(result.current).toBe(false);
    press("keydown", "Shift");
    press("keyup", "a");
    expect(result.current).toBe(true);
  });

  it("releases when the window loses focus", () => {
    const { result } = renderHook(() => useShiftHeld());
    press("keydown", "Shift");
    act(() => {
      globalThis.dispatchEvent(new Event("blur"));
    });
    expect(result.current).toBe(false);
  });

  it("stops listening after unmount", () => {
    const { result, unmount } = renderHook(() => useShiftHeld());
    unmount();
    press("keydown", "Shift");
    expect(result.current).toBe(false);
  });
});
