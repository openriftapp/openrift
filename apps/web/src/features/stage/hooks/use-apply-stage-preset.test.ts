import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAppliedStagePresetStore } from "@/features/stage/stores/applied-stage-preset-store";
import { createStoreResetter } from "@/test/store-helpers";

const presetsState: { data: { id: string; config: unknown }[] | undefined } = { data: undefined };
const apply = vi.fn();

vi.mock("@/features/stage/hooks/use-stage-presets", () => ({
  useStagePresets: () => presetsState,
}));
vi.mock("@/features/stage/stores/stage-preset-actions", () => ({
  applyStagePresetConfig: (config: unknown) => apply(config),
}));

const { useApplyStagePreset } = await import("./use-apply-stage-preset");

const resetApplied = createStoreResetter(useAppliedStagePresetStore);

describe("useApplyStagePreset", () => {
  afterEach(resetApplied);

  beforeEach(() => {
    apply.mockClear();
    presetsState.data = undefined;
  });

  it("applies the named preset once the list arrives, and only once", () => {
    const { rerender } = renderHook(() => useApplyStagePreset("p-1"));
    expect(apply).not.toHaveBeenCalled();

    presetsState.data = [{ id: "p-1", config: { ground: "green" } }];
    rerender();
    presetsState.data = [{ id: "p-1", config: { ground: "magenta" } }];
    rerender();

    expect(apply).toHaveBeenCalledOnce();
    expect(apply).toHaveBeenCalledWith({ ground: "green" });
  });

  it("ignores a preset id that does not resolve", () => {
    presetsState.data = [{ id: "p-2", config: {} }];
    renderHook(() => useApplyStagePreset("p-1"));

    expect(apply).not.toHaveBeenCalled();
  });

  it("does nothing without a preset in the URL", () => {
    presetsState.data = [{ id: "p-1", config: {} }];
    renderHook(() => useApplyStagePreset(undefined));

    expect(apply).not.toHaveBeenCalled();
  });

  it("does not apply the same preset again when another stage route mounts with it", () => {
    presetsState.data = [{ id: "p-1", config: { ground: "green" } }];
    const builder = renderHook(() => useApplyStagePreset("p-1"));
    builder.unmount();
    const show = renderHook(() => useApplyStagePreset("p-1"));
    show.unmount();
    renderHook(() => useApplyStagePreset("p-1"));

    expect(apply).toHaveBeenCalledOnce();
  });

  it("applies a different preset id named later in the same page load", () => {
    presetsState.data = [
      { id: "p-1", config: { ground: "green" } },
      { id: "p-2", config: { ground: "magenta" } },
    ];
    renderHook(() => useApplyStagePreset("p-1")).unmount();
    renderHook(() => useApplyStagePreset("p-2"));

    expect(apply).toHaveBeenCalledTimes(2);
    expect(apply).toHaveBeenLastCalledWith({ ground: "magenta" });
  });
});
