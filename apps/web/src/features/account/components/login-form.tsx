import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { Control, UseFormReturn } from "react-hook-form";
import { Controller, useForm, useFormState, useWatch } from "react-hook-form";
import { z } from "zod/v4";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TextLink } from "@/components/ui/text-link";
import { AuthFormCard, SocialAuthButtons } from "@/features/account/components/auth-form-shell";
import { SixDigitOtpInput } from "@/features/account/components/six-digit-otp-input";
import { authClient, signIn } from "@/features/account/lib/auth-client";
import { otpErrorMessage, requestOtpErrorMessage, setServerError } from "@/lib/auth-errors";
import { sessionQueryOptions } from "@/lib/auth-session";
import { m } from "@/paraglide/messages.js";

function signInSchema() {
  return z.object({
    email: z.email(m.auth_invalid_email()),
    password: z.string().min(1, m.auth_password_required()),
  });
}

type SignInValues = z.infer<ReturnType<typeof signInSchema>>;

/**
 * useWatch/useFormState/Controller stay in leaf components below, never in
 * LoginForm: lifting one re-renders the whole card per keystroke.
 */
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

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema()),
    defaultValues: { email: initialEmail, password: "" },
  });

  return (
    <AuthFormCard
      className={className}
      title={m.auth_login_title()}
      subtitle={m.auth_login_subtitle()}
      {...props}
    >
      <Tabs value={method} onValueChange={(v) => setMethod(v as "password" | "otp")}>
        <TabsList className="w-full">
          <TabsTrigger value="password">{m.auth_tab_password()}</TabsTrigger>
          <TabsTrigger value="otp">{m.auth_tab_email_code()}</TabsTrigger>
        </TabsList>
        <TabsContent value="password" tabIndex={-1}>
          <PasswordSignIn
            form={form}
            redirectTo={redirectTo}
            emailPlaceholder={emailPlaceholder}
            autoFocusEmail={!initialEmail}
          />
        </TabsContent>
        <TabsContent value="otp" tabIndex={-1}>
          {/* BaseUI keeps inactive panels mounted; the key clears a half-finished code on return. */}
          <OtpSignIn
            key={method}
            form={form}
            redirectTo={redirectTo}
            emailPlaceholder={emailPlaceholder}
          />
        </TabsContent>
      </Tabs>
      <SocialAuthButtons redirectTo={redirectTo} />
      <FieldDescription className="text-center">
        {m.auth_login_no_account()} <SignupLink control={form.control} redirectTo={redirectTo} />
      </FieldDescription>
    </AuthFormCard>
  );
}

function PasswordSignIn({
  form,
  redirectTo,
  emailPlaceholder,
  autoFocusEmail,
}: {
  form: UseFormReturn<SignInValues>;
  redirectTo?: string;
  emailPlaceholder: string;
  autoFocusEmail: boolean;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [resending, setResending] = useState(false);

  async function onSubmit(values: SignInValues) {
    setLoading(true);
    setEmailNotVerified(false);
    const result = await signIn.email(values).catch(() => null);
    setLoading(false);
    if (!result) {
      form.setError("root", { message: m.auth_signin_failed() });
      return;
    }
    const { error } = result;
    if (error) {
      if (error.code === "EMAIL_NOT_VERIFIED") {
        setEmailNotVerified(true);
      }
      setServerError(form, error);
      return;
    }
    // Cache is keyed by the prior session's userId; invalidate so it re-keys to the new one.
    await queryClient.invalidateQueries({ queryKey: sessionQueryOptions().queryKey });
    void navigate({ to: (redirectTo as "/collections") ?? "/collections" });
  }

  async function handleResend() {
    const email = form.getValues("email").trim();
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
    <form onSubmit={(event) => void form.handleSubmit(onSubmit)(event)} noValidate>
      <FieldGroup>
        <RootFormError control={form.control}>
          {emailNotVerified && (
            <Button
              type="button"
              variant="link-muted"
              className="ml-1 h-auto px-0 text-inherit hover:text-inherit"
              disabled={resending}
              onClick={() => void handleResend()}
            >
              {resending ? m.auth_sending() : m.auth_send_verification_code()}
            </Button>
          )}
        </RootFormError>
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>{m.auth_field_email()}</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="email"
                autoComplete="email"
                placeholder={emailPlaceholder}
                aria-invalid={fieldState.invalid}
                // oxlint-disable-next-line jsx-a11y/no-autofocus -- login page's primary input; skipped when prefilled from URL
                autoFocus={autoFocusEmail}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              {/* Grid places the Forgot link visually in the label row, but renders it DOM-after the input so tab order is input → Forgot */}
              <div className="grid grid-cols-[1fr_auto] items-center gap-x-2">
                <FieldLabel htmlFor={field.name} className="col-start-1 row-start-1">
                  {m.auth_field_password()}
                </FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={fieldState.invalid}
                  className="col-span-2 row-start-2"
                />
                <ForgotPasswordLink
                  control={form.control}
                  className="col-start-2 row-start-1 justify-self-end text-sm"
                />
              </div>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Field>
          <Button type="submit" disabled={loading}>
            {loading ? m.auth_signing_in() : m.auth_login_submit()}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}

function OtpSignIn({
  form,
  redirectTo,
  emailPlaceholder,
}: {
  form: UseFormReturn<SignInValues>;
  redirectTo?: string;
  emailPlaceholder: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"email" | "code">("email");
  const [otp, setOtp] = useState("");
  const [emailError, setEmailError] = useState("");
  const [otpError, setOtpError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSendOtp() {
    const email = form.getValues("email").trim();
    if (!email || !email.includes("@")) {
      setEmailError(m.auth_invalid_email());
      return;
    }
    setEmailError("");
    setLoading(true);
    const result = await authClient.emailOtp
      .sendVerificationOtp({ email, type: "sign-in" })
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
    setStep("code");
  }

  async function handleVerifyOtp() {
    if (otp.length < 6) {
      return;
    }
    setLoading(true);
    setOtpError("");
    const result = await authClient.signIn
      .emailOtp({ email: form.getValues("email").trim(), otp })
      .catch(() => null);
    setLoading(false);
    if (!result) {
      setOtpError(m.auth_signin_failed());
      return;
    }
    if (result.error) {
      setOtpError(otpErrorMessage(result.error));
      return;
    }
    await queryClient.invalidateQueries({ queryKey: sessionQueryOptions().queryKey });
    void navigate({ to: (redirectTo as "/collections") ?? "/collections" });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (step === "email") {
          void handleSendOtp();
        } else {
          void handleVerifyOtp();
        }
      }}
      noValidate
    >
      <FieldGroup>
        {step === "email" ? (
          <>
            {emailError && <FieldError>{emailError}</FieldError>}
            <Field>
              <FieldLabel htmlFor="otp-email">{m.auth_field_email()}</FieldLabel>
              <Controller
                name="email"
                control={form.control}
                render={({ field }) => (
                  <Input
                    {...field}
                    id="otp-email"
                    type="email"
                    autoComplete="email"
                    placeholder={emailPlaceholder}
                    aria-invalid={Boolean(emailError)}
                    // oxlint-disable-next-line jsx-a11y/no-autofocus -- OTP tab's primary input; panel remounts on tab switch so autofocus fires
                    autoFocus
                  />
                )}
              />
            </Field>
            <Field>
              <Button type="submit" disabled={loading}>
                {loading ? m.auth_sending() : m.auth_send_code()}
              </Button>
            </Field>
          </>
        ) : (
          <>
            {otpError && <FieldError>{otpError}</FieldError>}
            <div className="flex justify-center">
              <SixDigitOtpInput autoFocusOnMount value={otp} onChange={setOtp} />
            </div>
            <Field>
              <Button type="submit" disabled={otp.length < 6 || loading}>
                {loading ? m.auth_verifying() : m.auth_verify()}
              </Button>
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
    </form>
  );
}

function RootFormError({
  control,
  children,
}: {
  control: Control<SignInValues>;
  children?: React.ReactNode;
}) {
  const { errors } = useFormState({ control });
  if (!errors.root) {
    return null;
  }
  return (
    <FieldError>
      {errors.root.message}
      {children}
    </FieldError>
  );
}

function ForgotPasswordLink({
  control,
  className,
}: {
  control: Control<SignInValues>;
  className?: string;
}) {
  const email = useWatch({ control, name: "email" });
  return (
    <TextLink
      variant="muted"
      className={className}
      render={<Link to="/reset-password" search={{ email }} />}
    >
      {m.auth_forgot_password()}
    </TextLink>
  );
}

function SignupLink({
  control,
  redirectTo,
}: {
  control: Control<SignInValues>;
  redirectTo?: string;
}) {
  const email = useWatch({ control, name: "email" });
  return (
    <Link to="/signup" search={{ redirect: redirectTo, email: email || undefined }}>
      {m.common_sign_up()}
    </Link>
  );
}
