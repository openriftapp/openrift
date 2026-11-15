import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import type { RefObject } from "react";
import { useRef, useState } from "react";
import { z } from "zod/v4";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TextLink } from "@/components/ui/text-link";
import { AccountForm, AccountFormSubmit } from "@/features/account/components/account-form";
import { AuthDestinationPanel } from "@/features/account/components/auth-destination-panel";
import { AuthFormCard, SocialAuthButtons } from "@/features/account/components/auth-form-shell";
import { FormInputField } from "@/features/account/components/form-input-field";
import { SixDigitOtpInput } from "@/features/account/components/six-digit-otp-input";
import { useAccountForm } from "@/features/account/hooks/use-account-form";
import { isEmailAddress, OTP_LENGTH } from "@/features/account/lib/account-validation";
import { authClient, signIn } from "@/features/account/lib/auth-client";
import { authDestination } from "@/features/account/lib/auth-destination";
import { formText } from "@/features/account/lib/form-data";
import { isPlainClick } from "@/features/account/lib/plain-click";
import { isNewAccount, routeTemplate, trackSignupComplete, trackSignupCta } from "@/lib/analytics";
import { otpErrorMessage, requestOtpErrorMessage, setServerError } from "@/lib/auth-errors";
import { m } from "@/paraglide/messages.js";
import { enterAsSignedIn } from "@/stores/leave-as-signed-out";

function signInSchema() {
  return z.object({
    email: z.email(m.auth_invalid_email()),
    password: z.string().min(1, m.auth_password_required()),
  });
}

type SignInValues = z.infer<ReturnType<typeof signInSchema>>;

export function LoginForm({
  className,
  redirectTo,
  initialEmail = "",
  emailPlaceholder,
  ...props
}: React.ComponentProps<"div"> & {
  redirectTo?: string;
  initialEmail?: string;
  emailPlaceholder: string;
}) {
  const [method, setMethod] = useState<"password" | "otp">("password");
  const [email, setEmail] = useState(initialEmail);
  const [sentEmail, setSentEmail] = useState<string>();
  const passwordForm = useRef<HTMLFormElement>(null);
  const otpForm = useRef<HTMLFormElement>(null);
  const destination = authDestination(redirectTo);

  function typedEmail() {
    const form = (method === "password" ? passwordForm : otpForm).current;
    return form && new FormData(form).has("email")
      ? formText(form, "email").trim()
      : (sentEmail ?? email);
  }

  return (
    <AuthFormCard
      className={className}
      title={destination?.title ?? m.auth_login_title()}
      subtitle={destination ? undefined : m.auth_login_subtitle()}
      aside={destination && <AuthDestinationPanel destination={destination} />}
      {...props}
    >
      <Tabs
        value={method}
        onValueChange={(v) => {
          setEmail(typedEmail());
          setSentEmail(undefined);
          setMethod(v as "password" | "otp");
        }}
      >
        <TabsList className="w-full">
          <TabsTrigger value="password">{m.auth_tab_password()}</TabsTrigger>
          <TabsTrigger value="otp">{m.auth_tab_email_code()}</TabsTrigger>
        </TabsList>
        {/* BaseUI keeps inactive panels mounted; the keys remount both so each starts from the email read at the switch. */}
        <TabsContent value="password" tabIndex={-1}>
          <PasswordSignIn
            key={method}
            formRef={passwordForm}
            defaultEmail={email}
            redirectTo={redirectTo}
            emailPlaceholder={emailPlaceholder}
            autoFocusEmail={!initialEmail}
          />
        </TabsContent>
        <TabsContent value="otp" tabIndex={-1}>
          <OtpSignIn
            key={method}
            formRef={otpForm}
            defaultEmail={email}
            sentEmail={sentEmail}
            onSent={setSentEmail}
            redirectTo={redirectTo}
            emailPlaceholder={emailPlaceholder}
          />
        </TabsContent>
      </Tabs>
      <SocialAuthButtons redirectTo={redirectTo} />
      <FieldDescription className="text-center">
        {m.auth_login_no_account()} <SignupLink readEmail={typedEmail} redirectTo={redirectTo} />
      </FieldDescription>
    </AuthFormCard>
  );
}

function PasswordSignIn({
  formRef,
  defaultEmail,
  redirectTo,
  emailPlaceholder,
  autoFocusEmail,
}: {
  formRef: RefObject<HTMLFormElement | null>;
  defaultEmail: string;
  redirectTo?: string;
  emailPlaceholder: string;
  autoFocusEmail: boolean;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const form = useAccountForm(signInSchema());
  const [loading, setLoading] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string>();
  const [resending, setResending] = useState(false);

  async function onSubmit(values: SignInValues) {
    setLoading(true);
    setUnverifiedEmail(undefined);
    const result = await signIn.email(values).catch(() => null);
    setLoading(false);
    if (!result) {
      form.setError("root", { message: m.auth_signin_failed() });
      return;
    }
    const { error } = result;
    if (error) {
      if (error.code === "EMAIL_NOT_VERIFIED") {
        setUnverifiedEmail(values.email);
      }
      setServerError(form, error);
      return;
    }
    await enterAsSignedIn(queryClient, result.data.user.id);
    void navigate({ to: (redirectTo as "/collections") ?? "/collections" });
  }

  async function handleResend(email: string) {
    setResending(true);
    // /login has no field for the 6-digit code sendVerificationEmail would mail; use the OTP flow instead.
    const result = await authClient.emailOtp
      .sendVerificationOtp({ email, type: "email-verification" })
      .catch(() => null);
    setResending(false);
    if (!result) {
      form.setError("root", { message: m.auth_send_code_failed() });
      return;
    }
    if (result.error) {
      form.setError("root", { message: requestOtpErrorMessage(result.error) });
      return;
    }
    void navigate({ to: "/verify-email", search: { email, redirect: redirectTo } });
  }

  return (
    <AccountForm ref={formRef} onInput={form.handleInput} onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup>
        <RootFormError message={form.errors.root}>
          {unverifiedEmail !== undefined && (
            <Button
              pending={resending}
              type="button"
              variant="link-muted"
              className="ml-1 h-auto px-0 text-inherit hover:text-inherit"
              disabled={resending}
              onClick={() => void handleResend(unverifiedEmail.trim())}
            >
              {m.auth_send_verification_code()}
            </Button>
          )}
        </RootFormError>
        <FormInputField
          name="email"
          label={m.auth_field_email()}
          type="email"
          error={form.errors.email}
          defaultValue={defaultEmail}
          autoComplete="email"
          placeholder={emailPlaceholder}
          // oxlint-disable-next-line jsx-a11y/no-autofocus -- login page's primary input; skipped when prefilled from URL
          autoFocus={autoFocusEmail}
        />
        <Field data-invalid={form.errors.password !== undefined}>
          {/* Grid places the Forgot link visually in the label row, but renders it DOM-after the input so tab order is input → Forgot */}
          <div className="grid grid-cols-[1fr_auto] items-center gap-x-2">
            <FieldLabel htmlFor="password" className="col-start-1 row-start-1">
              {m.auth_field_password()}
            </FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={form.errors.password !== undefined}
              className="col-span-2 row-start-2"
            />
            <ForgotPasswordLink
              defaultEmail={defaultEmail}
              readEmail={() => (formRef.current ? formText(formRef.current, "email").trim() : "")}
              className="col-start-2 row-start-1 justify-self-end text-sm"
            />
          </div>
          {form.errors.password !== undefined && <FieldError>{form.errors.password}</FieldError>}
        </Field>
        <Field>
          <AccountFormSubmit pending={loading} className="w-full" disabled={loading}>
            {m.auth_login_submit()}
          </AccountFormSubmit>
        </Field>
      </FieldGroup>
    </AccountForm>
  );
}

function OtpSignIn({
  formRef,
  defaultEmail,
  sentEmail,
  onSent,
  redirectTo,
  emailPlaceholder,
}: {
  formRef: RefObject<HTMLFormElement | null>;
  defaultEmail: string;
  sentEmail?: string;
  onSent: (email: string) => void;
  redirectTo?: string;
  emailPlaceholder: string;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"email" | "code">("email");
  const [otp, setOtp] = useState("");
  const [emailError, setEmailError] = useState("");
  const [otpError, setOtpError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSendOtp(form: HTMLFormElement) {
    const typed = formText(form, "email").trim();
    if (!isEmailAddress(typed)) {
      setEmailError(m.auth_invalid_email());
      return;
    }
    setEmailError("");
    setLoading(true);
    const result = await authClient.emailOtp
      .sendVerificationOtp({ email: typed, type: "sign-in" })
      .catch(() => null);
    setLoading(false);
    if (!result) {
      setEmailError(m.auth_send_code_failed());
      return;
    }
    if (result.error) {
      setEmailError(requestOtpErrorMessage(result.error));
      return;
    }
    onSent(typed);
    setStep("code");
  }

  async function handleVerifyOtp(email: string) {
    if (otp.length < OTP_LENGTH) {
      return;
    }
    setLoading(true);
    setOtpError("");
    const result = await authClient.signIn.emailOtp({ email, otp }).catch(() => null);
    setLoading(false);
    if (!result) {
      setOtpError(m.auth_signin_failed());
      return;
    }
    if (result.error) {
      setOtpError(otpErrorMessage(result.error));
      return;
    }
    if (isNewAccount(result.data.user.createdAt)) {
      trackSignupComplete(
        "email-code",
        routeTemplate(redirectTo, (pathname) => router.matchRoutes(pathname)),
      );
    }
    await enterAsSignedIn(queryClient, result.data.user.id);
    void navigate({ to: (redirectTo as "/collections") ?? "/collections" });
  }

  return (
    <AccountForm
      ref={formRef}
      onSubmit={(event) => {
        if (step === "email") {
          void handleSendOtp(event.currentTarget);
        } else {
          void handleVerifyOtp(sentEmail ?? defaultEmail);
        }
      }}
    >
      <FieldGroup>
        {step === "email" ? (
          <>
            {emailError && <FieldError>{emailError}</FieldError>}
            <Field>
              <FieldLabel htmlFor="otp-email">{m.auth_field_email()}</FieldLabel>
              <Input
                id="otp-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder={emailPlaceholder}
                defaultValue={sentEmail ?? defaultEmail}
                aria-invalid={Boolean(emailError)}
                // oxlint-disable-next-line jsx-a11y/no-autofocus -- OTP tab's primary input; panel remounts on tab switch so autofocus fires
                autoFocus
              />
            </Field>
            <Field>
              <AccountFormSubmit pending={loading} className="w-full" disabled={loading}>
                {m.auth_send_code()}
              </AccountFormSubmit>
            </Field>
          </>
        ) : (
          <>
            {otpError && <FieldError>{otpError}</FieldError>}
            <div className="flex justify-center">
              <SixDigitOtpInput autoFocusOnMount value={otp} onChange={setOtp} />
            </div>
            <Field>
              <AccountFormSubmit
                pending={loading}
                className="w-full"
                disabled={otp.length < OTP_LENGTH || loading}
              >
                {m.auth_verify()}
              </AccountFormSubmit>
            </Field>
            <Button
              type="button"
              variant="link-muted"
              disabled={loading}
              onClick={() => {
                setStep("email");
                setOtp("");
                setOtpError("");
              }}
            >
              {m.auth_use_different_email()}
            </Button>
          </>
        )}
      </FieldGroup>
    </AccountForm>
  );
}

function RootFormError({ message, children }: { message?: string; children?: React.ReactNode }) {
  if (message === undefined) {
    return null;
  }
  return (
    <FieldError>
      {message}
      {children}
    </FieldError>
  );
}

function ForgotPasswordLink({
  defaultEmail,
  readEmail,
  className,
}: {
  defaultEmail: string;
  readEmail: () => string;
  className?: string;
}) {
  const navigate = useNavigate();
  return (
    <TextLink
      variant="muted"
      className={className}
      render={
        <Link
          rel="nofollow"
          to="/reset-password"
          search={{ email: defaultEmail }}
          onClick={(event) => {
            if (isPlainClick(event)) {
              event.preventDefault();
              void navigate({ to: "/reset-password", search: { email: readEmail() } });
            }
          }}
        />
      }
    >
      {m.auth_forgot_password()}
    </TextLink>
  );
}

function SignupLink({ readEmail, redirectTo }: { readEmail: () => string; redirectTo?: string }) {
  const navigate = useNavigate();
  return (
    <Link
      rel="nofollow"
      to="/signup"
      search={{ redirect: redirectTo, email: undefined }}
      onClick={(event) => {
        trackSignupCta("login-form");
        if (isPlainClick(event)) {
          event.preventDefault();
          void navigate({
            to: "/signup",
            search: { redirect: redirectTo, email: readEmail() || undefined },
          });
        }
      }}
    >
      {m.common_sign_up()}
    </Link>
  );
}
