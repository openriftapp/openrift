import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useScrollTargetStore } from "@/features/admin/stores/scroll-target-store";
import { createStoreResetter } from "@/test/store-helpers";

import { useScrollTarget } from "./use-scroll-target";

function Row({ scrollKey }: { scrollKey: string }) {
  const ref = useScrollTarget<HTMLDivElement>(scrollKey);
  return <div ref={ref}>{scrollKey}</div>;
}

let resetStore: () => void;
const scrollIntoView = vi.fn();
const original = Element.prototype.scrollIntoView;

beforeEach(() => {
  resetStore = createStoreResetter(useScrollTargetStore);
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  resetStore();
  Element.prototype.scrollIntoView = original;
});

describe("useScrollTarget", () => {
  it("scrolls a row that mounts after the scroll was asked for, then clears the request", () => {
    useScrollTargetStore.getState().scrollTo("face:face-jp", "center");

    render(<Row scrollKey="face:face-jp" />);

    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(useScrollTargetStore.getState().request).toBeNull();
  });

  it("scrolls a mounted row when asked, and leaves other rows alone", () => {
    const { container } = render(
      <>
        <Row scrollKey="face:face-en" />
        <Row scrollKey="face:face-jp" />
      </>,
    );

    act(() => useScrollTargetStore.getState().scrollTo("face:face-jp", "start"));

    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(scrollIntoView.mock.contexts[0]).toBe(container.lastElementChild);
  });

  it("scrolls again when the same row is asked for twice", () => {
    render(<Row scrollKey="needs-decision" />);

    act(() => useScrollTargetStore.getState().scrollTo("needs-decision", "start"));
    act(() => useScrollTargetStore.getState().scrollTo("needs-decision", "start"));

    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });
});
