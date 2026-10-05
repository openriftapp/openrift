import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CopyTextButton } from "./copy-text-button";

const writeText = vi.fn<(text: string) => Promise<void>>();

beforeEach(() => {
  writeText.mockReset();
  writeText.mockResolvedValue();
});

function setupUser() {
  const user = userEvent.setup();
  Object.defineProperty(globalThis.navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  return user;
}

describe("CopyTextButton", () => {
  it("copies a fixed value and swaps its label to Copied", async () => {
    const user = setupUser();
    render(<CopyTextButton value="!deck" label="Copy command" normalizeLineBreaks={false} />);

    await user.click(screen.getByRole("button", { name: "Copy command" }));

    expect(writeText).toHaveBeenCalledWith("!deck");
    await waitFor(() => expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy());
  });

  it("normalizes line breaks from getText by default", async () => {
    const user = setupUser();
    render(<CopyTextButton getText={() => "1 Jinx\n2 Vi"} label="Copy list" />);

    await user.click(screen.getByRole("button", { name: "Copy list" }));

    expect(writeText).toHaveBeenCalledWith("1 Jinx\r\n2 Vi");
  });

  it("names an icon-only button by its label, then Copied", async () => {
    const user = setupUser();
    render(<CopyTextButton value="ABC123" label="Copy code" iconOnly />);

    const button = screen.getByRole("button", { name: "Copy code" });
    expect(button.textContent).toBe("");
    await user.click(button);

    await waitFor(() => expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy());
  });

  it("copies nothing when getText rejects", async () => {
    const user = setupUser();
    render(<CopyTextButton getText={() => Promise.reject(new Error("offline"))} label="Copy" />);

    await user.click(screen.getByRole("button", { name: "Copy" }));

    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
  });
});
