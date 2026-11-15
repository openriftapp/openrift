import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const shellRenders = { card: 0, social: 0 };
const navigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    search,
    onClick,
  }: {
    children: ReactNode;
    to: string;
    search?: Record<string, unknown>;
    onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  }) => {
    const query = new URLSearchParams(
      Object.entries(search ?? {})
        .filter(([, value]) => value !== undefined && value !== "")
        .map(([key, value]) => [key, String(value)]),
    ).toString();
    return (
      <a href={query ? `${to}?${query}` : to} onClick={onClick}>
        {children}
      </a>
    );
  },
  useNavigate: () => navigate,
  useRouter: () => ({ matchRoutes: () => [] }),
}));

vi.mock("@/features/account/lib/auth-client", () => ({
  signUp: { email: vi.fn() },
}));

vi.mock("@/features/account/components/auth-form-shell", () => ({
  AuthFormCard: ({ aside, children }: { aside?: ReactNode; children: ReactNode }) => {
    shellRenders.card += 1;
    return (
      <div>
        {aside && <aside>{aside}</aside>}
        {children}
      </div>
    );
  },
  SocialAuthButtons: () => {
    shellRenders.social += 1;
    return <div data-slot="social" />;
  },
}));

const { SignupForm } = await import("./signup-form");

describe("SignupForm", () => {
  beforeEach(() => {
    shellRenders.card = 0;
    shellRenders.social = 0;
    navigate.mockReset();
  });

  it("does not re-render the surrounding card while typing an email", async () => {
    const user = userEvent.setup();
    render(<SignupForm emailPlaceholder="summoner@example.com" />);

    const rendersAfterMount = { ...shellRenders };
    expect(rendersAfterMount.social).toBeGreaterThan(0);

    const email = screen.getByLabelText("Email");
    await user.type(email, "jinx@example.com");

    expect(shellRenders.card).toBe(rendersAfterMount.card);
    expect(shellRenders.social).toBe(rendersAfterMount.social);
    expect(email).toHaveValue("jinx@example.com");
  });

  it("carries the email in the field at the moment the sign-in link is clicked", async () => {
    const user = userEvent.setup();
    render(<SignupForm emailPlaceholder="summoner@example.com" />);
    (screen.getByLabelText("Email") as HTMLInputElement).value = "vi@example.com";

    await user.click(screen.getByRole("link", { name: "Sign in" }));

    expect(navigate).toHaveBeenCalledWith({
      to: "/login",
      search: { redirect: undefined, email: "vi@example.com" },
    });
  });

  it("shows what the destination offers next to the form", () => {
    render(<SignupForm emailPlaceholder="summoner@example.com" redirectTo="/tournaments" />);

    expect(screen.getByRole("complementary")).toHaveTextContent("Tournaments");
  });

  it("shows no destination panel without a known destination", () => {
    render(<SignupForm emailPlaceholder="summoner@example.com" />);

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });
});
