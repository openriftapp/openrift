import { describe, expect, it } from "vitest";

import { createRecentAdds, suppressedLock } from "./scan-recent-adds";
import type { LockCheck } from "./scan-recent-adds";
import { createRelockGuard } from "./scan-relock";

describe("createRecentAdds", () => {
  it("remembers an artwork inside the window", () => {
    const recent = createRecentAdds(1000);
    recent.note("ahri", 0);
    expect(recent.seen("ahri", 1000)).toBe(true);
  });

  it("forgets an artwork once the window has passed", () => {
    const recent = createRecentAdds(1000);
    recent.note("ahri", 0);
    expect(recent.seen("ahri", 1001)).toBe(false);
  });

  it("knows only the artworks it was told about", () => {
    const recent = createRecentAdds(1000);
    recent.note("ahri", 0);
    expect(recent.seen("jinx", 10)).toBe(false);
  });

  it("forgets everything on clear", () => {
    const recent = createRecentAdds(1000);
    recent.note("ahri", 0);
    recent.clear();
    expect(recent.seen("ahri", 10)).toBe(false);
  });
});

describe("suppressedLock", () => {
  function check(overrides: Partial<LockCheck> = {}): LockCheck {
    return {
      artKey: "ahri",
      singleMode: true,
      sweeping: false,
      placedSinceLock: false,
      relock: createRelockGuard(),
      recentBoardAdds: createRecentAdds(1000),
      now: 0,
      ...overrides,
    };
  }

  it("lets a first add through", () => {
    expect(suppressedLock(check())).toBeNull();
  });

  it("holds back an aimed re-lock of the card still in the guide", () => {
    const relock = createRelockGuard();
    relock.note("ahri", 0);
    expect(suppressedLock(check({ relock }))).toBe("relock");
  });

  it("lets a sweep add a second copy of the same artwork", () => {
    const relock = createRelockGuard();
    relock.note("ahri", 0);
    expect(suppressedLock(check({ relock, sweeping: true }))).toBeNull();
  });

  it("lets a copy dealt onto a pile add the same artwork again", () => {
    const relock = createRelockGuard();
    relock.note("ahri", 0);
    expect(suppressedLock(check({ relock, placedSinceLock: true }))).toBeNull();
  });

  it("holds back a sweep lock of a card a board read just added", () => {
    const recentBoardAdds = createRecentAdds(1000);
    recentBoardAdds.note("ahri", 0);
    expect(suppressedLock(check({ recentBoardAdds, sweeping: true, now: 500 }))).toBe("board");
    expect(suppressedLock(check({ recentBoardAdds, sweeping: true, now: 1500 }))).toBeNull();
  });

  it("holds back an aimed lock of a card a board read just added, even once the guide emptied", () => {
    const relock = createRelockGuard(500);
    relock.note("ahri", 0);
    relock.observe(false, 0);
    relock.observe(false, 600);
    const recentBoardAdds = createRecentAdds(1000);
    recentBoardAdds.note("ahri", 0);

    expect(relock.allows("ahri")).toBe(true);
    expect(suppressedLock(check({ relock, recentBoardAdds, now: 900 }))).toBe("board");
    expect(suppressedLock(check({ relock, recentBoardAdds, now: 1500 }))).toBeNull();
  });

  it("lets a tap add a card a board read just added", () => {
    const recentBoardAdds = createRecentAdds(1000);
    recentBoardAdds.note("ahri", 0);
    expect(suppressedLock(check({ recentBoardAdds, singleMode: false, now: 500 }))).toBeNull();
  });
});
