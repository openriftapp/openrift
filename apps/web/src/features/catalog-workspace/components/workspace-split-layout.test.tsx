import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WorkspaceSplitLayout } from "./workspace-split-layout";

function layout(recordKey: string | null) {
  return (
    <WorkspaceSplitLayout
      header={<button type="button">New</button>}
      list={<input aria-label="Search" />}
      recordKey={recordKey}
      recordFirst={recordKey !== null}
      collapsed={false}
    >
      <p>Record body</p>
    </WorkspaceSplitLayout>
  );
}

describe("WorkspaceSplitLayout", () => {
  it("moves focus from a queue control to the record pane when the record changes", () => {
    const { rerender } = render(layout("card:a"));
    screen.getByRole("button", { name: "New" }).focus();

    rerender(layout("card:b"));

    expect(screen.getByRole("region", { name: "Record" })).toHaveFocus();
  });

  it("leaves focus alone on the first render and when the record stays the same", () => {
    const { rerender } = render(layout("card:a"));
    expect(document.body).toHaveFocus();
    const button = screen.getByRole("button", { name: "New" });
    button.focus();

    rerender(layout("card:a"));

    expect(button).toHaveFocus();
  });

  it("does not take focus from a field being typed in", () => {
    const { rerender } = render(layout("card:a"));
    const field = screen.getByRole("textbox", { name: "Search" });
    field.focus();

    rerender(layout("card:b"));

    expect(field).toHaveFocus();
  });

  it("does not take focus while an overlay is open", () => {
    const { rerender } = render(layout("card:a"));
    const button = screen.getByRole("button", { name: "New" });
    button.focus();
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.append(dialog);

    rerender(layout("card:b"));

    expect(button).toHaveFocus();
    dialog.remove();
  });
});
