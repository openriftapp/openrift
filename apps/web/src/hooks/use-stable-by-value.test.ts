import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useStableByValue } from "./use-stable-by-value";

describe("useStableByValue", () => {
  it("keeps the first instance while the value serializes the same", () => {
    const first = { domains: ["fury"], energy: { min: null, max: 3 } };
    const { result, rerender } = renderHook(({ value }) => useStableByValue(value), {
      initialProps: { value: first },
    });
    rerender({ value: { domains: ["fury"], energy: { min: null, max: 3 } } });
    expect(result.current).toBe(first);
  });

  it("switches to the new instance when the value changes", () => {
    const { result, rerender } = renderHook(({ value }) => useStableByValue(value), {
      initialProps: { value: { domains: ["fury"] } },
    });
    const next = { domains: ["fury", "calm"] };
    rerender({ value: next });
    expect(result.current).toBe(next);
    rerender({ value: { domains: ["fury", "calm"] } });
    expect(result.current).toBe(next);
  });
});
