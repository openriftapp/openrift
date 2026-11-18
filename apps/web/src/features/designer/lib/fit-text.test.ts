import { describe, expect, it } from "vitest";

import { shrinkToFit } from "./fit-text";

function fakeContent(heightAtFullSize: number, baseCqw: number) {
  const style = { fontSize: "" };
  return {
    style,
    get offsetHeight() {
      return (heightAtFullSize * Number(style.fontSize.replace("cqw", ""))) / baseCqw;
    },
  };
}

describe("shrinkToFit", () => {
  it("keeps the base size when the text fits", () => {
    const content = fakeContent(80, 4);
    expect(shrinkToFit({ clientHeight: 100 }, content, 4)).toBe(1);
    expect(content.style.fontSize).toBe("4cqw");
  });

  it("shrinks in steps until the text fits", () => {
    const content = fakeContent(120, 4);
    expect(shrinkToFit({ clientHeight: 100 }, content, 4)).toBe(0.8);
    expect(content.style.fontSize).toBe("3.2cqw");
  });

  it("stops at 60% when the text never fits", () => {
    const content = fakeContent(1000, 4);
    expect(shrinkToFit({ clientHeight: 100 }, content, 4)).toBe(0.6);
    expect(content.style.fontSize).toBe("2.4cqw");
  });

  it("starts again from the base size on every call", () => {
    const content = fakeContent(80, 4);
    content.style.fontSize = "2.4cqw";
    expect(shrinkToFit({ clientHeight: 100 }, content, 4)).toBe(1);
    expect(content.style.fontSize).toBe("4cqw");
  });
});
