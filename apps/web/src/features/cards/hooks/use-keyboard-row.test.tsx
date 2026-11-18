// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { useKeyboardRow } from "./use-keyboard-row";

function Grid({ tiles }: { tiles: string[] }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const { keyboardRow, onFocus, onBlur } = useKeyboardRow(container, tiles);
  return (
    <>
      <div ref={setContainer} onFocus={onFocus} onBlur={onBlur}>
        {tiles.map((tile, index) => (
          <div key={tile} data-index={index}>
            <a href={`/cards/${tile}`}>{tile}</a>
          </div>
        ))}
      </div>
      <output aria-label="Keyboard row">{keyboardRow ?? "none"}</output>
      <a href="/footer">Footer</a>
    </>
  );
}

const row = () => screen.getByRole("status", { name: "Keyboard row" });

describe("useKeyboardRow", () => {
  it("tracks the row that holds keyboard focus", async () => {
    const user = userEvent.setup();
    render(<Grid tiles={["annie", "garen"]} />);

    await user.tab();
    await user.tab();

    expect(row()).toHaveTextContent("1");
  });

  it("drops the row once the focus leaves the grid", async () => {
    const user = userEvent.setup();
    render(<Grid tiles={["annie", "garen"]} />);

    await user.tab();
    await user.tab();
    await user.tab();

    expect(row()).toHaveTextContent("none");
  });

  it("drops the row when the focused tile unmounts without a blur", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Grid tiles={["annie", "garen"]} />);
    await user.tab();
    await user.tab();
    expect(row()).toHaveTextContent("1");

    rerender(<Grid tiles={["annie"]} />);

    expect(row()).toHaveTextContent("none");
  });
});
