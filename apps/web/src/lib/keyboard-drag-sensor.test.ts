// @vitest-environment happy-dom
import type { KeyboardSensorProps, SensorContext } from "@dnd-kit/core";
import { KeyboardSensor } from "@dnd-kit/core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NonScrollingKeyboardSensor } from "./keyboard-drag-sensor";

function keydown(code: string): KeyboardEvent {
  return new KeyboardEvent("keydown", { code, bubbles: true, cancelable: true });
}

function startSensor() {
  const page = document.documentElement;
  const scrollTo = vi.spyOn(page, "scrollTo").mockImplementation(() => {});
  const grip = document.createElement("button");
  document.body.append(grip);
  const activation = keydown("Space");
  const props = {
    active: "row-2",
    activeNode: {
      id: "row-2",
      key: "row-2",
      node: { current: grip },
      activatorNode: { current: grip },
      data: { current: {} },
    },
    event: activation,
    context: {
      current: {
        collisionRect: { top: 40, left: 0, width: 100, height: 20, bottom: 60, right: 100 },
        scrollableAncestors: [page],
      } as unknown as SensorContext,
    },
    options: {
      coordinateGetter: (event: KeyboardEvent) =>
        event.code === "ArrowDown" ? { x: 0, y: 90 } : undefined,
    },
    onAbort: vi.fn(),
    onPending: vi.fn(),
    onStart: vi.fn(),
    onCancel: vi.fn(),
    onMove: vi.fn(),
    onEnd: vi.fn(),
  } satisfies KeyboardSensorProps;
  const sensor = new NonScrollingKeyboardSensor(props);
  return { props, scrollTo, sensor };
}

describe("NonScrollingKeyboardSensor", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("starts from any grip the stock keyboard sensor would start from", () => {
    expect(NonScrollingKeyboardSensor.activators).toBe(KeyboardSensor.activators);
  });

  it("moves by the coordinate getter's step and leaves the page scroll alone", () => {
    const { props, scrollTo } = startSensor();

    document.dispatchEvent(keydown("ArrowDown"));

    expect(props.onMove).toHaveBeenCalledWith({ x: 0, y: 50 });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("drops on Space and cancels on Escape", () => {
    const dropped = startSensor();
    document.dispatchEvent(keydown("Space"));
    expect(dropped.props.onEnd).toHaveBeenCalledOnce();

    const cancelled = startSensor();
    document.dispatchEvent(keydown("Escape"));
    expect(cancelled.props.onCancel).toHaveBeenCalledOnce();
  });
});
