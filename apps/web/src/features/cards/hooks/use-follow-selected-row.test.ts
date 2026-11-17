// @vitest-environment happy-dom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useFollowSelectedRow } from "./use-follow-selected-row";

interface Props {
  selectedItemId: string | undefined;
  rowIndex: number;
  layout: number;
  listKey: string;
}

function setup(selectedItemId: string | undefined, rowIndex: number, layout = 3, listKey = "") {
  const scrollToCard = vi.fn();
  const hook = renderHook(
    (props: Props) =>
      useFollowSelectedRow(
        props.selectedItemId,
        props.rowIndex,
        props.layout,
        props.listKey,
        scrollToCard,
      ),
    { initialProps: { selectedItemId, rowIndex, layout, listKey } },
  );
  return { ...hook, scrollToCard };
}

describe("useFollowSelectedRow", () => {
  it("follows the selected card when a filter change moves it to another row", () => {
    const { rerender, scrollToCard } = setup("card-a", 1);

    rerender({ selectedItemId: "card-a", rowIndex: 9, layout: 3, listKey: "q=jinx" });

    expect(scrollToCard).toHaveBeenCalledExactlyOnceWith("card-a");
  });

  it("follows when the filtered list lands a render after the filter", () => {
    const { rerender, scrollToCard } = setup("card-a", 1);

    rerender({ selectedItemId: "card-a", rowIndex: 1, layout: 3, listKey: "q=jinx" });
    rerender({ selectedItemId: "card-a", rowIndex: 9, layout: 3, listKey: "q=jinx" });

    expect(scrollToCard).toHaveBeenCalledExactlyOnceWith("card-a");
  });

  it("does not follow a row change under the same filters, transient or not", () => {
    const { rerender, scrollToCard } = setup("card-a", 1);

    rerender({ selectedItemId: "card-a", rowIndex: 2, layout: 3, listKey: "" });
    rerender({ selectedItemId: "card-a", rowIndex: -1, layout: 3, listKey: "" });
    rerender({ selectedItemId: "card-a", rowIndex: 2, layout: 3, listKey: "" });

    expect(scrollToCard).not.toHaveBeenCalled();
  });

  it("does nothing on mount or while the row stays the same", () => {
    const { rerender, scrollToCard } = setup("card-a", 1);

    rerender({ selectedItemId: "card-a", rowIndex: 1, layout: 3, listKey: "q=jinx" });

    expect(scrollToCard).not.toHaveBeenCalled();
  });

  it("leaves a new selection, a layout change and a dropped card to other code", () => {
    const { rerender, scrollToCard } = setup("card-a", 1);

    rerender({ selectedItemId: "card-b", rowIndex: 4, layout: 3, listKey: "a" });
    rerender({ selectedItemId: "card-b", rowIndex: 6, layout: 4, listKey: "b" });
    rerender({ selectedItemId: "card-b", rowIndex: -1, layout: 4, listKey: "c" });
    rerender({ selectedItemId: undefined, rowIndex: -1, layout: 4, listKey: "d" });

    expect(scrollToCard).not.toHaveBeenCalled();
  });
});
