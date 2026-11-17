// @vitest-environment happy-dom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useFollowSelectedRow } from "./use-follow-selected-row";

function setup(selectedItemId: string | undefined, rowIndex: number, layout = 3) {
  const scrollToCard = vi.fn();
  const hook = renderHook(
    (props: { selectedItemId: string | undefined; rowIndex: number; layout: number }) =>
      useFollowSelectedRow(props.selectedItemId, props.rowIndex, props.layout, scrollToCard),
    { initialProps: { selectedItemId, rowIndex, layout } },
  );
  return { ...hook, scrollToCard };
}

describe("useFollowSelectedRow", () => {
  it("follows the selected card when the list moves it to another row", () => {
    const { rerender, scrollToCard } = setup("card-a", 1);

    rerender({ selectedItemId: "card-a", rowIndex: 9, layout: 3 });

    expect(scrollToCard).toHaveBeenCalledExactlyOnceWith("card-a");
  });

  it("does nothing on mount or while the row stays the same", () => {
    const { rerender, scrollToCard } = setup("card-a", 1);

    rerender({ selectedItemId: "card-a", rowIndex: 1, layout: 3 });

    expect(scrollToCard).not.toHaveBeenCalled();
  });

  it("leaves a new selection, a layout change and a dropped card to other code", () => {
    const { rerender, scrollToCard } = setup("card-a", 1);

    rerender({ selectedItemId: "card-b", rowIndex: 4, layout: 3 });
    rerender({ selectedItemId: "card-b", rowIndex: 6, layout: 4 });
    rerender({ selectedItemId: "card-b", rowIndex: -1, layout: 4 });
    rerender({ selectedItemId: undefined, rowIndex: -1, layout: 4 });

    expect(scrollToCard).not.toHaveBeenCalled();
  });
});
