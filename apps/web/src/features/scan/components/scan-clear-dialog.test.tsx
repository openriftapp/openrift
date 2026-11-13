import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ScanClearDialog } from "./scan-clear-dialog";

describe("ScanClearDialog", () => {
  it("clears and closes when Enter confirms", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    const onOpenChange = vi.fn();
    render(<ScanClearDialog count={3} onOpenChange={onOpenChange} onClear={onClear} />);

    await screen.findByRole("alertdialog");
    await user.keyboard("{Enter}");

    expect(onClear).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
