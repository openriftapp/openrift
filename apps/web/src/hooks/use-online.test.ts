import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useOnline } from "./use-online";

describe("useOnline", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads the browser's online flag", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(false);
  });

  it("follows the offline and online events", () => {
    const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true);

    onLine.mockReturnValue(false);
    act(() => {
      globalThis.dispatchEvent(new Event("offline"));
    });
    expect(result.current).toBe(false);

    onLine.mockReturnValue(true);
    act(() => {
      globalThis.dispatchEvent(new Event("online"));
    });
    expect(result.current).toBe(true);
  });
});
