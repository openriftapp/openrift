import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CopyTextPanel } from "./copy-text-panel";

describe("CopyTextPanel", () => {
  it("shows the text in a read-only field beside the copy button", () => {
    render(<CopyTextPanel text={"2x Yasuo\n1x Ahri"} />);
    const field = screen.getByRole("textbox");
    expect(field).toHaveValue("2x Yasuo\n1x Ahri");
    expect(field).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: /copy/iu })).toBeInTheDocument();
  });

  it("shows progress instead of an empty field while the text is still being built", () => {
    render(<CopyTextPanel text="" isLoading />);
    expect(screen.getByText(/preparing/iu)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /copy/iu })).not.toBeInTheDocument();
  });

  it("offers nothing to copy when there is no text", () => {
    render(<CopyTextPanel text="" emptyNote="Nothing to share yet." />);
    expect(screen.getByText("Nothing to share yet.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
