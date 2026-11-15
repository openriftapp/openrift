import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod/v4";

import { useAccountForm } from "./use-account-form";

const schema = z.object({
  name: z.string().trim().min(1, "Enter a name."),
  email: z.email("Enter an email."),
});

function NameForm({
  onValid,
}: {
  onValid: (values: z.output<typeof schema>, form: HTMLFormElement) => void;
}) {
  const form = useAccountForm(schema);
  return (
    <form aria-label="Profile" onInput={form.handleInput} onSubmit={form.handleSubmit(onValid)}>
      <input aria-label="Name" name="name" defaultValue="" />
      <input aria-label="Email" name="email" defaultValue="" />
      <button type="button" onClick={() => form.setError("root", { message: "Server said no." })}>
        Fail
      </button>
      {Object.entries(form.errors).map(([field, message]) =>
        message ? <p key={field}>{`${field}: ${message}`}</p> : null,
      )}
    </form>
  );
}

function submit() {
  fireEvent.submit(screen.getByRole("form", { name: "Profile" }));
}

describe("useAccountForm", () => {
  it("passes the parsed values and the form to the handler", () => {
    const onValid = vi.fn();
    render(<NameForm onValid={onValid} />);
    (screen.getByLabelText("Name") as HTMLInputElement).value = " Jinx ";
    (screen.getByLabelText("Email") as HTMLInputElement).value = "jinx@example.com";

    submit();

    expect(onValid).toHaveBeenCalledWith(
      { name: "Jinx", email: "jinx@example.com" },
      screen.getByRole("form", { name: "Profile" }),
    );
  });

  it("shows each invalid field's error at submit and does not call the handler", () => {
    const onValid = vi.fn();
    render(<NameForm onValid={onValid} />);

    submit();

    expect(onValid).not.toHaveBeenCalled();
    expect(screen.getByText("name: Enter a name.")).toBeInTheDocument();
    expect(screen.getByText("email: Enter an email.")).toBeInTheDocument();
  });

  it("focuses the first invalid field in form order", () => {
    render(<NameForm onValid={vi.fn()} />);
    (screen.getByLabelText("Name") as HTMLInputElement).value = "Jinx";

    submit();

    expect(screen.getByLabelText("Email")).toHaveFocus();
  });

  it("clears only the edited field's error", () => {
    render(<NameForm onValid={vi.fn()} />);
    submit();

    fireEvent.input(screen.getByLabelText("Name"), { target: { value: "J" } });

    expect(screen.queryByText("name: Enter a name.")).not.toBeInTheDocument();
    expect(screen.getByText("email: Enter an email.")).toBeInTheDocument();
  });

  it("clears a server error on the next valid submit", () => {
    render(<NameForm onValid={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Fail" }));
    expect(screen.getByText("root: Server said no.")).toBeInTheDocument();
    (screen.getByLabelText("Name") as HTMLInputElement).value = "Vi";
    (screen.getByLabelText("Email") as HTMLInputElement).value = "vi@example.com";

    submit();

    expect(screen.queryByText("root: Server said no.")).not.toBeInTheDocument();
  });
});
