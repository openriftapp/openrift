import { describe, expect, it } from "vitest";

import { moveInOrder, toggleInOrder } from "./ordered-toggle";

describe("toggleInOrder", () => {
  it("appends a value that is not enabled", () => {
    expect(toggleInOrder(["a", "b"], "c")).toEqual(["a", "b", "c"]);
  });

  it("removes an enabled value and keeps the rest in order", () => {
    expect(toggleInOrder(["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });

  it("can empty the order", () => {
    expect(toggleInOrder(["a"], "a")).toEqual([]);
  });
});

describe("moveInOrder", () => {
  it("moves a value up", () => {
    expect(moveInOrder(["a", "b", "c"], "c", -1)).toEqual(["a", "c", "b"]);
  });

  it("moves a value down", () => {
    expect(moveInOrder(["a", "b", "c"], "a", 1)).toEqual(["b", "a", "c"]);
  });

  it("leaves the order unchanged past either end", () => {
    expect(moveInOrder(["a", "b"], "a", -1)).toEqual(["a", "b"]);
    expect(moveInOrder(["a", "b"], "b", 1)).toEqual(["a", "b"]);
  });

  it("leaves the order unchanged for a value that is not enabled", () => {
    expect(moveInOrder(["a", "b"], "z", 1)).toEqual(["a", "b"]);
  });
});
