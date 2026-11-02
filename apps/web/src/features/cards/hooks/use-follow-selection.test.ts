import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDisplayStore } from "@/stores/display-store";
import { createStoreResetter } from "@/test/store-helpers";

import { useFollowSelection } from "./use-follow-selection";

const mobile = vi.hoisted(() => ({ value: false }));
vi.mock("@/hooks/use-is-mobile", () => ({ useIsMobile: () => mobile.value }));

const resetDisplayStore = createStoreResetter(useDisplayStore);

beforeEach(() => {
  mobile.value = false;
});

afterEach(() => {
  resetDisplayStore();
});

function follow() {
  return renderHook(() => useFollowSelection()).result.current;
}

describe("useFollowSelection", () => {
  it("follows the first selection only while the modal steps", () => {
    const check = follow();

    expect(check("a")).toBe(true);
    expect(check("b")).toBe(false);
  });

  it("follows again after the selection clears", () => {
    const check = follow();

    check("a");
    expect(check(null)).toBe(false);
    expect(check("b")).toBe(true);
  });

  it("follows every step of the docked pane", () => {
    useDisplayStore.setState({ paneDocked: true });
    const check = follow();

    check("a");
    expect(check("b")).toBe(true);
  });

  it("follows every step of the mobile overlay", () => {
    mobile.value = true;
    const check = follow();

    check("a");
    expect(check("b")).toBe(true);
  });
});
