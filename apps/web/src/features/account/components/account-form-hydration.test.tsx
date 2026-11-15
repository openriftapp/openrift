// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { act, useState } from "react";
import { hydrateRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  getRouteApi: () => ({
    useSearch: () => ({ email: "" }),
    useLoaderData: () => ({ emailPlaceholder: "summoner@example.com" }),
  }),
  useNavigate: () => vi.fn(),
  useRouter: () => ({ matchRoutes: () => [] }),
}));

vi.mock("@/features/account/lib/auth-client", () => ({
  signIn: { email: vi.fn() },
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

const { AccountForm } = await import("./account-form");
const { LoginForm } = await import("./login-form");
const { ResetPasswordPage } = await import("./reset-password-page");
const { AccountInfoSection } = await import("./account-info-section");
const { PublicProfileSection } = await import("./public-profile-section");
const { signIn, authClient } = await import("@/features/account/lib/auth-client");
const signInEmail = vi.mocked(signIn.email);
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

function input(label: string | RegExp) {
  return screen.getByLabelText(label, { selector: "input" }) as HTMLInputElement;
}

function fill(element: HTMLInputElement | HTMLTextAreaElement, value: string, events: boolean) {
  element.value = value;
  if (events) {
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

async function click(name: string) {
  await act(async () => {
    screen.getByRole("button", { name }).click();
  });
}

const loginForm = <LoginForm emailPlaceholder="summoner@example.com" />;

function NoteForm() {
  const [note, setNote] = useState("");
  return (
    <AccountForm>
      <label htmlFor="note">Note</label>
      <input id="note" name="note" value={note} onChange={(event) => setNote(event.target.value)} />
    </AccountForm>
  );
}

describe("AccountForm across hydration", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    signInEmail.mockReset();
    signInEmail.mockResolvedValue({ data: null, error: { message: "Nope", status: 401 } } as never);
    sendVerificationOtp.mockReset();
    sendVerificationOtp.mockResolvedValue({ error: { status: 429 } } as never);
    updateUser.mockReset();
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

  it.each([
    ["typed with events", true],
    ["filled without events", false],
  ])("signs in with credentials %s before hydration", async (_label, events) => {
    serverRender(loginForm);
    fill(input("Email"), "viktor@example.com", events);
    fill(input("Password"), "hextech-secret", events);

    await hydrate(loginForm);

    expect(input("Email").value).toBe("viktor@example.com");
    expect(input("Password").value).toBe("hextech-secret");
    expect(consoleError).not.toHaveBeenCalled();

    await click("Sign in");

    expect(signInEmail).toHaveBeenCalledWith({
      email: "viktor@example.com",
      password: "hextech-secret",
    });
    expect(screen.queryByText("Please enter a valid email address.")).not.toBeInTheDocument();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("sends a password set after hydration without events", async () => {
    serverRender(loginForm);
    await hydrate(loginForm);

    fill(input("Email"), "jayce@example.com", false);
    fill(input("Password"), "hammer-time", false);
    await click("Sign in");

    expect(signInEmail).toHaveBeenCalledWith({
      email: "jayce@example.com",
      password: "hammer-time",
    });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("leaves the caret of the field being typed in alone at mount", async () => {
    serverRender(loginForm);
    fill(input("Email"), "viktor@example.com", false);
    fill(input("Password"), "hextech-secret", false);
    input("Password").focus();
    input("Password").setSelectionRange(3, 3);

    await hydrate(loginForm);

    expect(input("Password").selectionStart).toBe(3);
    expect(input("Password").value).toBe("hextech-secret");

    await click("Sign in");

    expect(signInEmail).toHaveBeenCalledWith({
      email: "viktor@example.com",
      password: "hextech-secret",
    });
  });

  it("keeps the typed value when the value setter cannot be found", async () => {
    serverRender(<NoteForm />);
    const note = input("Note");
    Object.setPrototypeOf(note, Object.create(HTMLInputElement.prototype));
    fill(note, "Piltover", false);

    await hydrate(<NoteForm />);

    expect(note.value).toBe("Piltover");
  });

  it("sends a reset email typed before hydration", async () => {
    serverRender(<ResetPasswordPage />);
    fill(input("Email"), "ekko@example.com", true);

    await hydrate(<ResetPasswordPage />);
    await click("Send code");

    expect(sendVerificationOtp).toHaveBeenCalledWith({
      email: "ekko@example.com",
      type: "forget-password",
    });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("sends a reset email set without events on a state-bound field", async () => {
    serverRender(<ResetPasswordPage />);
    await hydrate(<ResetPasswordPage />);

    fill(input("Email"), "caitlyn@example.com", false);
    await click("Send code");

    expect(sendVerificationOtp).toHaveBeenCalledWith({
      email: "caitlyn@example.com",
      type: "forget-password",
    });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("resets with a new password set without events", async () => {
    sendVerificationOtp.mockResolvedValue({ error: null } as never);
    serverRender(<ResetPasswordPage />);
    await hydrate(<ResetPasswordPage />);
    fill(input("Email"), "vi@example.com", false);
    await click("Send code");

    const user = userEvent.setup();
    await user.type(await screen.findByRole("textbox"), "123456");
    fill(input("New password"), "zaun-forever", false);
    fill(input("Confirm password"), "zaun-forever", false);
    await click("Reset password");

    expect(resetPassword).toHaveBeenCalledWith({
      email: "vi@example.com",
      otp: "123456",
      password: "zaun-forever",
    });
  });

  it("reports an empty new password instead of sending it", async () => {
    sendVerificationOtp.mockResolvedValue({ error: null } as never);
    serverRender(<ResetPasswordPage />);
    await hydrate(<ResetPasswordPage />);
    fill(input("Email"), "vi@example.com", false);
    await click("Send code");

    const user = userEvent.setup();
    await user.type(await screen.findByRole("textbox"), "123456");
    await click("Reset password");

    expect(resetPassword).not.toHaveBeenCalled();
    expect(screen.getByText(/at least \d+ characters/u)).toBeInTheDocument();
  });

  it("keeps the server's display name and Riot ID over values left in the inputs", async () => {
    const section = (
      <AccountInfoSection
        defaultName="Riven Fan"
        defaultRiotId="rivenfan#EUW"
        userId="user-1"
        currentEmail="vi@example.com"
      />
    );
    serverRender(section);
    fill(input("Name"), "", false);
    fill(input("Riot ID"), "stale#EUW", true);

    await hydrate(section);

    expect(input("Name").value).toBe("Riven Fan");
    expect(input("Riot ID").value).toBe("rivenfan#EUW");
    for (const save of screen.getAllByRole("button", { name: "Save" })) {
      expect(save).toBeDisabled();
    }
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("keeps an empty bio over a restored one", async () => {
    const section = (
      <PublicProfileSection
        userId="user-1"
        values={{
          bio: null,
          profileShowRiotId: false,
          profileShowCollection: false,
          profileShowLastActive: true,
          profileShowReferralTier: true,
        }}
      />
    );
    serverRender(section);
    fill(screen.getByLabelText("Bio") as HTMLTextAreaElement, "Restored draft", false);

    await hydrate(section);

    expect((screen.getByLabelText("Bio") as HTMLTextAreaElement).value).toBe("");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});
