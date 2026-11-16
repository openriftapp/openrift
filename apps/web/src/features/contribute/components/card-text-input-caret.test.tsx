import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { CardTextInput } from "./card-text-input";

let commitPending: () => void = () => {};

function DeferredHost({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <CardTextInput
      label="Rules text"
      variant="flavor"
      value={value}
      onChange={(next) => {
        commitPending = () => setValue(next);
      }}
    />
  );
}

describe("CardTextInput caret", () => {
  it("puts the caret inside an inserted wrap once the parent commits the value", async () => {
    const user = userEvent.setup();
    render(<DeferredHost initial="Hello" />);
    const textarea = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Rules text" });
    textarea.setSelectionRange(5, 5);

    await user.click(screen.getByRole("button", { name: "Curly double quotes" }));
    act(() => commitPending());

    expect(textarea.value).toBe("Hello“”");
    expect(textarea.selectionStart).toBe(6);
    expect(document.activeElement).toBe(textarea);
  });
});
