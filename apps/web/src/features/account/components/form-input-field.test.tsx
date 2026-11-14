import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import { FormInputField } from "./form-input-field";

function PasswordForm({ error }: { error?: string }) {
  const form = useForm<{ password: string }>({
    defaultValues: { password: "" },
    errors: error === undefined ? undefined : { password: { type: "manual", message: error } },
  });
  return (
    <FormInputField
      control={form.control}
      name="password"
      label="Password"
      type="password"
      autoComplete="new-password"
    />
  );
}

describe("FormInputField", () => {
  it("labels the input and passes its type and autocomplete through", () => {
    render(<PasswordForm />);
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveAttribute("autocomplete", "new-password");
    expect(input).not.toHaveAttribute("placeholder");
    expect(input).toHaveAttribute("aria-invalid", "false");
  });

  it("marks the input invalid and shows the field error", () => {
    render(<PasswordForm error="Enter a password." />);
    expect(screen.getByText("Enter a password.")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
  });
});
