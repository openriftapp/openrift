import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CardDetailDialogShell } from "./card-detail-shells";

describe("CardDetailDialogShell", () => {
  it("anchors the dialog near the top instead of vertically centering it", () => {
    render(
      <CardDetailDialogShell onClose={() => {}}>
        <p>body</p>
      </CardDetailDialogShell>,
    );
    const tokens = screen.getByRole("dialog").className.split(/\s+/u);
    expect(tokens).toContain("top-[8dvh]");
    expect(tokens).toContain("translate-y-0");
    expect(tokens).toContain("-translate-x-1/2");
    expect(tokens).not.toContain("top-1/2");
    expect(tokens).not.toContain("-translate-y-1/2");
    expect(tokens).not.toContain("max-h-[calc(100dvh-2rem)]");
  });
});
