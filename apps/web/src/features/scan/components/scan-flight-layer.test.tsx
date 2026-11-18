import { render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import type { ScanFlight } from "./scan-flight-layer";
import { ScanFlightLayer } from "./scan-flight-layer";

vi.mock("@/lib/media-query", () => ({ prefersReducedMotion: () => true }));

function flight(id: string): ScanFlight {
  return {
    id,
    image: `https://img.test/${id}.webp`,
    source: { x: 0, y: 0, width: 50, height: 70 },
  };
}

describe("ScanFlightLayer", () => {
  it("ends every flight at once under reduced motion", () => {
    const onFlightEnd = vi.fn();
    render(
      <ScanFlightLayer
        flights={[flight("a"), flight("b")]}
        targetRef={createRef()}
        onFlightEnd={onFlightEnd}
      />,
    );

    expect(onFlightEnd.mock.calls.map(([id]) => id).toSorted()).toEqual(["a", "b"]);
  });

  it("ends dropped flights through the newest callback", () => {
    const first = vi.fn();
    const latest = vi.fn();
    const targetRef = createRef<HTMLElement>();
    const { rerender } = render(
      <ScanFlightLayer
        flights={[flight("a")]}
        targetRef={targetRef}
        onFlightEnd={first}
        maxConcurrent={1}
      />,
    );
    first.mockClear();

    rerender(
      <ScanFlightLayer
        flights={[flight("a"), flight("b")]}
        targetRef={targetRef}
        onFlightEnd={latest}
        maxConcurrent={1}
      />,
    );

    expect(latest).toHaveBeenCalledWith("a");
    expect(first).not.toHaveBeenCalled();
  });
});
