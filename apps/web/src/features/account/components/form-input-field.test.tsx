import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FormInputField } from "./form-input-field";

describe("FormInputField", () => {
  it("labels an uncontrolled input and passes its name, type and autocomplete through", () => {
    render(
      <FormInputField
        name="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        defaultValue="hextech"
      />,
    );
    const input = screen.getByLabelText("Password") as HTMLInputElement;
    expect(input).toHaveAttribute("name", "password");
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveAttribute("autocomplete", "new-password");
    expect(input).not.toHaveAttribute("placeholder");
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(input.value).toBe("hextech");
  });

  it("marks the input invalid and shows the field error", () => {
    render(<FormInputField name="password" label="Password" type="password" error="Too short." />);
    expect(screen.getByText("Too short.")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
  });
});
