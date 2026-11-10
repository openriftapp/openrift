import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/account/lib/auth-client", () => ({
  authClient: { signIn: { social: vi.fn() } },
}));

const { AuthFormCard } = await import("./auth-form-shell");

describe("AuthFormCard", () => {
  it("shows the logo beside the form when there is no panel", () => {
    render(
      <AuthFormCard title="Welcome back" subtitle="Sign in to your OpenRift account">
        <form />
      </AuthFormCard>,
    );

    expect(screen.getAllByRole("img", { name: "OpenRift" })).toHaveLength(2);
    expect(screen.getByText("Sign in to your OpenRift account")).toBeInTheDocument();
  });

  it("puts the panel in place of the side logo", () => {
    render(
      <AuthFormCard title="Sign in to open your groups" aside={<p>Groups panel</p>}>
        <form />
      </AuthFormCard>,
    );

    expect(screen.getByText("Groups panel")).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: "OpenRift" })).toHaveLength(1);
  });

  it("renders no subtitle paragraph without a subtitle", () => {
    const { container } = render(
      <AuthFormCard title="Sign in to open your groups">
        <form />
      </AuthFormCard>,
    );

    expect(container.querySelector("h1 + p")).toBeNull();
  });
});
