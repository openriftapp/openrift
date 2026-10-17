import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useMountedAt } from "./use-mounted-at";

describe("useMountedAt", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the mount time and keeps it across re-renders", () => {
    vi.useFakeTimers({ now: new Date("2026-10-17T10:00:00.000Z") });
    const { result, rerender } = renderHook(() => useMountedAt());
    const first = result.current;
    expect(first.toISOString()).toBe("2026-10-17T10:00:00.000Z");

    vi.setSystemTime(new Date("2026-10-17T11:00:00.000Z"));
    rerender();

    expect(result.current).toBe(first);
  });

  it("gives a new mount its own time", () => {
    vi.useFakeTimers({ now: new Date("2026-10-17T10:00:00.000Z") });
    renderHook(() => useMountedAt());
    vi.setSystemTime(new Date("2026-10-17T11:00:00.000Z"));

    const { result } = renderHook(() => useMountedAt());

    expect(result.current.toISOString()).toBe("2026-10-17T11:00:00.000Z");
  });
});
