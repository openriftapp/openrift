import type { PodResponse } from "@openrift/shared/types/api/pod-tournament";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useResultBaseline } from "./use-result-baseline";

function pod(gamePoints: [number | null, number | null]): PodResponse {
  return {
    id: "pod-1",
    podNumber: 1,
    size: 2,
    resultStatus: "pending",
    penalty: null,
    members: gamePoints.map((points, index) => ({
      playerId: `p${index}`,
      displayName: `P${index}`,
      image: null,
      gravatarHash: null,
      teamId: null,
      gamePoints: points,
      placement: null,
      points: null,
    })),
  };
}

describe("useResultBaseline", () => {
  it("flags a result someone else saved while the form was open", () => {
    const { result, rerender } = renderHook(({ current }) => useResultBaseline(current), {
      initialProps: { current: pod([null, null]) },
    });
    expect(result.current.changedRemotely).toBe(false);

    rerender({ current: pod([2, 0]) });
    expect(result.current.changedRemotely).toBe(true);

    act(() => result.current.acceptLatest());
    expect(result.current.changedRemotely).toBe(false);
  });

  it("ignores other players' scores when watching one player", () => {
    const { result, rerender } = renderHook(({ current }) => useResultBaseline(current, "p0"), {
      initialProps: { current: pod([null, null]) },
    });

    rerender({ current: pod([null, 3]) });
    expect(result.current.changedRemotely).toBe(false);

    rerender({ current: pod([1, 3]) });
    expect(result.current.changedRemotely).toBe(true);
  });

  it("does not report the viewer's own save as a remote change while the refetch is pending", () => {
    const { result, rerender } = renderHook(({ current }) => useResultBaseline(current, "p0"), {
      initialProps: { current: pod([null, null]) },
    });

    act(() => result.current.adoptSaved([{ playerId: "p0", gamePoints: 2 }]));
    act(() => result.current.resync());
    expect(result.current.changedRemotely).toBe(false);

    rerender({ current: pod([2, null]) });
    expect(result.current.changedRemotely).toBe(false);

    act(() => result.current.resync());
    rerender({ current: pod([1, null]) });
    expect(result.current.changedRemotely).toBe(true);
  });
});
