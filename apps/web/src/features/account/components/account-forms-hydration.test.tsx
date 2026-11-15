// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    onClick,
  }: {
    children: ReactNode;
    to: string;
    onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  }) => (
    <a href={to} onClick={onClick}>
      {children}
    </a>
  ),
  getRouteApi: () => ({
    useSearch: () => ({ email: "" }),
    useLoaderData: () => ({ emailPlaceholder: "summoner@example.com" }),
  }),
  useNavigate: () => navigate,
  useRouter: () => ({ matchRoutes: () => [] }),
}));

vi.mock("@/features/account/lib/auth-client", () => ({
  signIn: { email: vi.fn() },
  signUp: { email: vi.fn() },
  authClient: {
    updateUser: vi.fn(),
    signIn: { emailOtp: vi.fn() },
    emailOtp: {
      sendVerificationOtp: vi.fn(),
      resetPassword: vi.fn(),
      requestEmailChange: vi.fn(),
      changeEmail: vi.fn(),
    },
  },
}));

vi.mock("@/features/account/components/auth-form-shell", () => ({
  AuthFormCard: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SocialAuthButtons: () => null,
}));

const { LoginForm } = await import("./login-form");
const { SignupForm } = await import("./signup-form");
const { ResetPasswordPage } = await import("./reset-password-page");
const { AccountInfoSection } = await import("./account-info-section");
const { PublicProfileSection } = await import("./public-profile-section");
const { signIn, signUp, authClient } = await import("@/features/account/lib/auth-client");
const signInEmail = vi.mocked(signIn.email);
const signUpEmail = vi.mocked(signUp.email);
const sendVerificationOtp = vi.mocked(authClient.emailOtp.sendVerificationOtp);
const updateUser = vi.mocked(authClient.updateUser);
const resetPassword = vi.mocked(authClient.emailOtp.resetPassword);

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
let root: Root | undefined;
let container: HTMLElement | undefined;

function withProviders(ui: ReactNode) {
  return <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>;
}

function serverRender(ui: ReactNode) {
  container = document.createElement("div");
  container.innerHTML = renderToString(withProviders(ui));
  document.body.append(container);
}

async function hydrate(ui: ReactNode) {
  await act(async () => {
    root = hydrateRoot(container as HTMLElement, withProviders(ui));
  });
}

function field(label: string) {
  return screen.getByLabelText(label, { selector: "input, textarea" }) as
    | HTMLInputElement
    | HTMLTextAreaElement;
}

async function click(name: string) {
  await act(async () => {
    screen.getByRole("button", { name }).click();
  });
}

const loginForm = <LoginForm emailPlaceholder="summoner@example.com" />;
const signupForm = <SignupForm emailPlaceholder="summoner@example.com" />;

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  navigate.mockReset();
  signInEmail.mockReset();
  signInEmail.mockResolvedValue({ data: null, error: { message: "Nope", status: 401 } } as never);
  signUpEmail.mockReset();
  signUpEmail.mockResolvedValue({ data: null, error: { message: "Nope", status: 400 } } as never);
  sendVerificationOtp.mockReset();
  sendVerificationOtp.mockResolvedValue({ error: null } as never);
  updateUser.mockReset();
  updateUser.mockResolvedValue({ data: { status: true }, error: null } as never);
  resetPassword.mockReset();
  resetPassword.mockResolvedValue({ error: { status: 400 } } as never);
  consoleError = vi.spyOn(console, "error");
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  consoleError.mockRestore();
});

describe("account forms filled before hydration", () => {
  it("signs in with what the browser holds, without a hydration warning", async () => {
    serverRender(loginForm);
    field("Email").value = "viktor@example.com";
    field("Password").value = "hextech-secret";

    await hydrate(loginForm);
    await click("Sign in");

    expect(signInEmail).toHaveBeenCalledWith({
      email: "viktor@example.com",
      password: "hextech-secret",
    });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("signs in with values set after hydration without events", async () => {
    serverRender(loginForm);
    await hydrate(loginForm);
    field("Email").value = "jayce@example.com";
    field("Password").value = "hammer-time";

    await click("Sign in");

    expect(signInEmail).toHaveBeenCalledWith({
      email: "jayce@example.com",
      password: "hammer-time",
    });
  });

  it("carries an email entered before hydration into the links and the other tab", async () => {
    serverRender(loginForm);
    field("Email").value = "ekko@example.com";

    await hydrate(loginForm);
    await act(async () => {
      screen.getByRole("link", { name: "Forgot your password?" }).click();
    });
    expect(navigate).toHaveBeenLastCalledWith({
      to: "/reset-password",
      search: { email: "ekko@example.com" },
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Email code" }));
    const otpEmail = document.querySelector<HTMLInputElement>("#otp-email");
    expect(otpEmail?.value).toBe("ekko@example.com");
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("leaves the caret of the field being typed in alone", async () => {
    serverRender(loginForm);
    field("Password").value = "hextech-secret";
    const password = field("Password") as HTMLInputElement;
    password.focus();
    password.setSelectionRange(3, 3);

    await hydrate(loginForm);

    expect(password.selectionStart).toBe(3);
    expect(password.value).toBe("hextech-secret");
  });

  it("signs up with what the browser holds", async () => {
    serverRender(signupForm);
    field("Name").value = "Ekko";
    field("Email").value = "ekko@example.com";
    field("Password").value = "zaun-forever";

    await hydrate(signupForm);
    await click("Sign up");

    expect(signUpEmail).toHaveBeenCalledWith({
      name: "Ekko",
      email: "ekko@example.com",
      password: "zaun-forever",
    });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("resets a password with an email and new password the browser holds", async () => {
    serverRender(<ResetPasswordPage />);
    field("Email").value = "vi@example.com";

    await hydrate(<ResetPasswordPage />);
    await click("Send code");

    expect(sendVerificationOtp).toHaveBeenCalledWith({
      email: "vi@example.com",
      type: "forget-password",
    });
    const user = userEvent.setup();
    await user.type(await screen.findByRole("textbox"), "123456");
    field("New password").value = "zaun-forever";
    field("Confirm password").value = "zaun-forever";
    await click("Reset password");

    expect(resetPassword).toHaveBeenCalledWith({
      email: "vi@example.com",
      otp: "123456",
      password: "zaun-forever",
    });
    expect(consoleError).not.toHaveBeenCalled();
  });
});

describe("account form validation at submit", () => {
  it("shows the sign-in errors for empty fields and sends nothing", async () => {
    render(withProviders(loginForm));

    await click("Sign in");

    expect(signInEmail).not.toHaveBeenCalled();
    expect(screen.getByText("Please enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
  });

  it("shows the sign-up errors for an invalid email and short password", async () => {
    render(withProviders(signupForm));
    field("Name").value = "Ekko";
    field("Email").value = "ekko@";
    field("Password").value = "short";

    await click("Sign up");

    expect(signUpEmail).not.toHaveBeenCalled();
    expect(screen.getByText("Please enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText(/at least \d+ characters/u)).toBeInTheDocument();
  });

  it("reports mismatched reset passwords instead of sending them", async () => {
    render(withProviders(<ResetPasswordPage />));
    field("Email").value = "vi@example.com";
    await click("Send code");
    const user = userEvent.setup();
    await user.type(await screen.findByRole("textbox"), "123456");
    field("New password").value = "zaun-forever";
    field("Confirm password").value = "piltover-forever";

    await click("Reset password");

    expect(resetPassword).not.toHaveBeenCalled();
    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
  });
});

function infoSection(defaultName: string) {
  return withProviders(
    <AccountInfoSection
      defaultName={defaultName}
      defaultRiotId="rivenfan#EUW"
      userId="user-1"
      currentEmail="vi@example.com"
    />,
  );
}

function bioSection(bio: string | null) {
  return withProviders(
    <PublicProfileSection
      userId="user-1"
      values={{
        bio,
        profileShowRiotId: false,
        profileShowCollection: false,
        profileShowLastActive: true,
        profileShowReferralTier: true,
      }}
    />,
  );
}

function saveButtons() {
  return screen.getAllByRole("button", { name: "Save" });
}

describe("profile fields", () => {
  it("shows the server's values with Save off until one differs", async () => {
    const user = userEvent.setup();
    render(infoSection("Riven Fan"));
    expect(field("Name").value).toBe("Riven Fan");
    expect(field("Riot ID").value).toBe("rivenfan#EUW");
    for (const save of saveButtons()) {
      expect(save).toBeDisabled();
    }

    await user.type(field("Name"), "!");
    expect(saveButtons()[0]).toBeEnabled();
    await user.type(field("Name"), "{Backspace}");
    expect(saveButtons()[0]).toBeDisabled();
  });

  it("offers to save a name typed before hydration, with the bio count to match", async () => {
    const section = (
      <>
        {infoSection("Riven Fan")}
        {bioSection(null)}
      </>
    );
    serverRender(section);
    field("Name").value = "Yasuo Main";
    field("Bio").value = "Fury and Chaos";

    await hydrate(section);

    const [nameSave, , bioSave] = saveButtons();
    expect(nameSave).toBeEnabled();
    expect(bioSave).toBeEnabled();
    expect(screen.getByText(/ 14\//u)).toBeInTheDocument();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("keeps the saved name and focus after Enter, with Save off", async () => {
    const user = userEvent.setup();
    const { rerender } = render(infoSection("Riven Fan"));
    await user.clear(field("Name"));
    await user.type(field("Name"), "  Yasuo Main {Enter}");

    expect(updateUser).toHaveBeenCalledWith({ name: "Yasuo Main" });
    rerender(infoSection("Yasuo Main"));

    expect(field("Name")).toHaveFocus();
    expect(field("Name").value).toBe("  Yasuo Main ");
    expect(saveButtons()[0]).toBeDisabled();
    expect(await screen.findByText("Name updated.")).toBeInTheDocument();
  });

  it("counts the bio as it is typed and turns Save off once it is saved", async () => {
    const user = userEvent.setup();
    const { rerender } = render(bioSection("Fury"));
    expect(field("Bio").value).toBe("Fury");
    expect(screen.getByText(/ 4\//u)).toBeInTheDocument();

    await user.type(field("Bio"), " and Chaos ");
    expect(screen.getByText(/ 15\//u)).toBeInTheDocument();
    await click("Save");
    expect(updateUser).toHaveBeenCalledWith({ bio: "Fury and Chaos" });
    rerender(bioSection("Fury and Chaos"));

    expect(field("Bio").value).toBe("Fury and Chaos ");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});

describe("focus after a failed submit", () => {
  it("moves focus to the sign-up email when it is the first invalid field", async () => {
    render(withProviders(signupForm));
    field("Name").value = "Ekko";
    field("Email").value = "ekko@";
    field("Password").value = "zaun-forever";

    await click("Sign up");

    expect(field("Email")).toHaveFocus();
  });
});
