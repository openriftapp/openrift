import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useRecordSelection } from "./use-record-selection";

describe("useRecordSelection", () => {
  it("ticks, unticks and clears keys", () => {
    const { result } = renderHook(() => useRecordSelection());

    act(() => result.current.handleToggle("a", true));
    act(() => result.current.handleToggle("b", true));
    expect([...result.current.selected]).toEqual(["a", "b"]);

    act(() => result.current.handleToggle("a", false));
    expect([...result.current.selected]).toEqual(["b"]);

    act(() => result.current.clear());
    expect(result.current.selected.size).toBe(0);
  });
});
