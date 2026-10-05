import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { Link, useNavigate, getRouteApi } from "@tanstack/react-router";
import { useState } from "react";

import { AuthPageLayout } from "@/components/layout/auth-page-layout";
import { PROSE_MARKUP } from "@/components/message-markup";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AuthFormCard } from "@/features/account/components/auth-form-shell";
import { SixDigitOtpInput } from "@/features/account/components/six-digit-otp-input";
import { authClient } from "@/features/account/lib/auth-client";
import { otpErrorMessage, requestOtpErrorMessage } from "@/lib/auth-errors";
import { m } from "@/paraglide/messages.js";

const routeApi = getRouteApi("/_app/reset-password");

export function ResetPasswordPage() {
  const { email: initialEmail } = routeApi.useSearch();
  const { emailPlaceholder } = routeApi.useLoaderData();
  const navigate = useNavigate();

  // A prefilled email does not skip to the code step: that step says a code was
  // sent, which only `handleSendCode` can make true.
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState(initialEmail);
  const [emailError, setEmailError] = useState("");

  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleSendCode() {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setEmailError(m.auth_reset_email_invalid());
      return;
    }
    setEmailError("");
    setLoading(true);
    const result = await authClient.emailOtp
      .sendVerificationOtp({ email: trimmed, type: "forget-password" })
      .catch(() => null);
    setLoading(false);
    if (!result) {
      setEmailError(m.auth_reset_send_failed());
      return;
    }
    if (result.error) {
      setEmailError(requestOtpErrorMessage(result.error));
      return;
    }
    setStep("code");
  }

  async function handleResend() {
    setResending(true);
    setError("");
    const result = await authClient.emailOtp
      .sendVerificationOtp({ email: email.trim(), type: "forget-password" })
      .catch(() => null);
    setResending(false);
    if (!result) {
      setError(m.auth_reset_send_failed());
      return;
    }
    if (result.error) {
      setError(requestOtpErrorMessage(result.error));
    }
  }

  async function handleReset() {
    setError("");
    if (newPassword.length < 8) {
      setError(m.auth_reset_password_too_short());
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(m.auth_reset_password_mismatch());
      return;
    }
    setLoading(true);
    const result = await authClient.emailOtp
      .resetPassword({ email: email.trim(), otp, password: newPassword })
      .catch(() => null);
    setLoading(false);
    if (!result) {
      setError(m.auth_reset_failed());
      return;
    }
    if (result.error) {
      setError(otpErrorMessage(result.error));
      return;
    }
    void navigate({ to: "/login", search: { redirect: undefined, email: email.trim() } });
  }

  return (
    <AuthPageLayout size="2xl">
      <AuthFormCard
        layout="single"
        title={m.auth_reset_title()}
        subtitle={
          step === "email" ? (
            m.auth_reset_intro()
          ) : (
            <ParaglideMessage
              message={m.auth_reset_code_intro}
              inputs={{ email: email.trim() }}
              markup={PROSE_MARKUP}
            />
          )
        }
      >
        {step === "email" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleSendCode();
            }}
            noValidate
          >
            <FieldGroup>
              {emailError && <FieldError>{emailError}</FieldError>}
              <Field>
                <FieldLabel htmlFor="reset-email">{m.auth_reset_email_label()}</FieldLabel>
                <Input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  placeholder={emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={Boolean(emailError)}
                  // oxlint-disable-next-line jsx-a11y/no-autofocus -- reset-password step's primary input
                  autoFocus
                />
              </Field>
              <Field>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? m.auth_reset_sending() : m.auth_reset_send_code()}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleReset();
            }}
            noValidate
          >
            <FieldGroup>
              {error && <FieldError>{error}</FieldError>}
              <Field className="items-center">
                <SixDigitOtpInput autoFocusOnMount value={otp} onChange={setOtp} />
              </Field>
              <Field>
                <FieldLabel htmlFor="new-password">{m.auth_reset_new_password_label()}</FieldLabel>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="confirm-password">
                  {m.auth_reset_confirm_password_label()}
                </FieldLabel>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </Field>
              <Field>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={otp.length < 6 || !newPassword || loading}
                >
                  {loading ? m.auth_reset_resetting() : m.auth_reset_submit()}
                </Button>
                <Button
                  type="button"
                  variant="link-muted"
                  disabled={resending}
                  onClick={() => void handleResend()}
                >
                  {resending ? m.auth_reset_sending() : m.auth_reset_resend()}
                </Button>
                <p className="text-muted-foreground text-sm">{m.auth_reset_spam_hint()}</p>
              </Field>
            </FieldGroup>
          </form>
        )}

        <p className="text-muted-foreground text-center text-sm">
          <Link
            to="/login"
            search={{ redirect: undefined, email: email.trim() || undefined }}
            className="underline underline-offset-2"
          >
            {m.auth_back_to_login()}
          </Link>
        </p>
      </AuthFormCard>
    </AuthPageLayout>
  );
}
