import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Combobox, ComboboxInput } from "./combobox";

describe("ComboboxInput", () => {
  it("renders its chevron trigger without a Base UI nativeButton warning", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <Combobox items={["Origins"]}>
        <ComboboxInput aria-label="Set" />
      </Combobox>,
    );
    expect(errors.mock.calls.map((call) => String(call[0]))).not.toContainEqual(
      expect.stringContaining("nativeButton"),
    );
    errors.mockRestore();
  });
});
