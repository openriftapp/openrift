import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TokenLinkControl } from "./token-link-control";

const labels = {
  label: "Report link",
  enableLabel: "Create report link",
  disableLabel: "Disable",
  disableTitle: "Disable the report link?",
  disableDescription: "The old link stops working.",
  disableConfirmLabel: "Disable link",
};

describe("TokenLinkControl", () => {
  it("still lets a cancelled event switch a live link off", () => {
    render(
      <TokenLinkControl
        {...labels}
        url="https://example.test/tournaments/report/tok"
        locked
        pending={false}
        onSet={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Disable" })).toBeEnabled();
  });

  it("blocks disabling when the caller locks it", () => {
    render(
      <TokenLinkControl
        {...labels}
        url="https://example.test/tournaments/submit/tok"
        locked
        disableLocked
        pending={false}
        onSet={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Disable" })).toBeDisabled();
  });

  it("blocks enabling on a locked event", () => {
    render(<TokenLinkControl {...labels} url={null} locked pending={false} onSet={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Create report link" })).toBeDisabled();
  });
});
