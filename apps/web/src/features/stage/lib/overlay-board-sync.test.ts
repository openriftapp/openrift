import type { OverlayBoard } from "@openrift/shared/contracts/overlay";
import { describe, expect, it, vi } from "vitest";

import type { OverlayBoardFrame } from "./overlay-board-sync";
import { createOverlayBoardSync } from "./overlay-board-sync";

const BOARD: OverlayBoardFrame = {
  title: "Origins, ranked",
  tiers: [{ label: "S", cards: [{ cardId: "card-a", printingId: null }] }],
  direction: "best-first",
};

function deferred() {
  let land: () => void = () => {};
  const promise = new Promise<void>((resolve) => {
    land = resolve;
  });
  return { promise, resolve: land };
}

function harness() {
  const calls: string[] = [];
  const pushBoard = vi.fn((board: OverlayBoard) => {
    calls.push(`push:${board.revealCount}`);
    return Promise.resolve();
  });
  const setReveal = vi.fn((revealCount: number) => {
    calls.push(`reveal:${revealCount}`);
    return Promise.resolve();
  });
  const clear = vi.fn(() => {
    calls.push("clear");
    return Promise.resolve();
  });
  return {
    sync: createOverlayBoardSync({ pushBoard, setReveal, clear }),
    pushBoard,
    setReveal,
    clear,
    calls,
  };
}

async function settle() {
  for (let tick = 0; tick < 6; tick += 1) {
    await Promise.resolve();
  }
}

describe("createOverlayBoardSync", () => {
  it("pushes the board with the reveal folded in", () => {
    const { sync, pushBoard } = harness();

    sync.send({ board: BOARD, revealCount: 3 });

    expect(pushBoard).toHaveBeenCalledWith({ ...BOARD, revealCount: 3 });
  });

  it("steps the board already up without resending it", async () => {
    const { sync, setReveal, pushBoard } = harness();
    sync.send({ board: BOARD, revealCount: 0 });
    await settle();

    sync.send({ board: BOARD, revealCount: 2 });

    expect(setReveal).toHaveBeenCalledWith(2);
    expect(pushBoard).toHaveBeenCalledTimes(1);
  });

  it("pushes the whole board again when the ranking changed", async () => {
    const { sync, pushBoard } = harness();
    sync.send({ board: BOARD, revealCount: 0 });
    await settle();

    sync.send({ board: { ...BOARD, tiers: [] }, revealCount: 0 });

    expect(pushBoard).toHaveBeenCalledTimes(2);
  });

  it("sends only the latest position once the wire is free", async () => {
    const { sync, calls } = harness();
    sync.send({ board: BOARD, revealCount: 0 });
    sync.send({ board: BOARD, revealCount: 1 });
    sync.send({ board: BOARD, revealCount: 2 });
    sync.send({ board: BOARD, revealCount: 3 });

    await settle();

    expect(calls).toEqual(["push:0", "reveal:3"]);
  });

  it("folds a step into a board push that is still waiting", async () => {
    const { sync, calls } = harness();
    sync.send({ board: BOARD, revealCount: 0 });
    sync.send({ board: { ...BOARD, direction: "worst-first" }, revealCount: 1 });
    sync.send({ board: { ...BOARD, direction: "worst-first" }, revealCount: 2 });

    await settle();

    expect(calls).toEqual(["push:0", "push:2"]);
  });

  it("pushes the whole board again when the last push was refused", async () => {
    const { sync, pushBoard, setReveal } = harness();
    pushBoard.mockImplementationOnce(() => Promise.reject(new Error("nope")));
    sync.send({ board: BOARD, revealCount: 0 });
    await settle();

    sync.send({ board: BOARD, revealCount: 1 });

    expect(pushBoard).toHaveBeenCalledTimes(2);
    expect(pushBoard).toHaveBeenLastCalledWith({ ...BOARD, revealCount: 1 });
    expect(setReveal).not.toHaveBeenCalled();
  });

  it("carries on after a refused step", async () => {
    const { sync, setReveal } = harness();
    sync.send({ board: BOARD, revealCount: 0 });
    await settle();
    setReveal.mockImplementationOnce(() => Promise.reject(new Error("nope")));
    sync.send({ board: BOARD, revealCount: 1 });
    sync.send({ board: BOARD, revealCount: 2 });

    await settle();

    expect(setReveal).toHaveBeenLastCalledWith(2);
  });

  it("takes the board down only after the push in flight has landed", async () => {
    const { sync, pushBoard, clear, calls } = harness();
    const push = deferred();
    pushBoard.mockImplementationOnce(() => {
      calls.push("push");
      return push.promise;
    });
    sync.send({ board: BOARD, revealCount: 0 });
    sync.send({ board: BOARD, revealCount: 1 });

    sync.clear();
    expect(clear).not.toHaveBeenCalled();

    push.resolve();
    await settle();

    expect(calls).toEqual(["push", "clear"]);
  });

  it("puts the whole board back up after a clear", async () => {
    const { sync, pushBoard } = harness();
    sync.send({ board: BOARD, revealCount: 0 });
    await settle();
    sync.clear();
    await settle();

    sync.send({ board: BOARD, revealCount: 1 });

    expect(pushBoard).toHaveBeenCalledTimes(2);
  });

  it("pushes the whole board after forget, even one that landed after it", async () => {
    const { sync, pushBoard } = harness();
    const push = deferred();
    pushBoard.mockImplementationOnce(() => push.promise);
    sync.send({ board: BOARD, revealCount: 0 });
    sync.forget();
    push.resolve();
    await settle();

    sync.send({ board: BOARD, revealCount: 1 });

    expect(pushBoard).toHaveBeenCalledTimes(2);
  });
});
