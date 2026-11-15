import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BuilderWorkbench } from "./builder-workbench";

describe("BuilderWorkbench", () => {
  it("narrows the browser's left bleed to the gap beside the aside", () => {
    render(
      <BuilderWorkbench topBar={<div />} aside={<div>Scene</div>}>
        <div>Browser</div>
      </BuilderWorkbench>,
    );
    const column = screen.getByText("Browser").parentElement;
    expect(column?.className).toContain("lg:[--gutter-left:1rem]");
  });
});
