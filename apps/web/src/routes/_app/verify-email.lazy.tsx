import { useQueryClient } from "@tanstack/react-query";
import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Heading } from "@/components/heading";
import { AuthPageLayout } from "@/components/layout/auth-page-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldGroup } from "@/components/ui/field";
import { SixDigitOtpInput } from "@/features/account/components/six-digit-otp-input";
import { authClient } from "@/features/account/lib/auth-client";
import { otpErrorMessage } from "@/lib/auth-errors";
import { sessionQueryOptions } from "@/lib/auth-session";
import { m } from "@/paraglide/messages.js";

export const Route = createLazyFileRoute("/_app/verify-email")({
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { email, redirect: redirectTo } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");

  async function handleVerify(code: string) {
    if (code.length < 6) {
      return;
    }
    setVerifying(true);
    setError("");
    const result = await authClient.emailOtp.verifyEmail({ email, otp: code }).catch(() => null);
    setVerifying(false);
    if (!result) {
      setError(m.auth_verify_failed());
      return;
    }
    if (result.error) {
      setError(otpErrorMessage(result.error));
      return;
    }
    // better-auth set the cookie, but the ["session"] query cache still holds
    // null from before verification.
    await queryClient.invalidateQueries({ queryKey: sessionQueryOptions().queryKey });
    void navigate({ to: (redirectTo as "/collections") ?? "/collections" });
  }

  async function handleResend() {
    setResending(true);
    setError("");
    const result = await authClient.emailOtp
      .sendVerificationOtp({ email, type: "email-verification" })
      .catch(() => null);
    setResending(false);
    if (!result) {
      setError(m.auth_verify_resend_failed());
    }
  }

  return (
    <AuthPageLayout>
      <Card className="overflow-hidden p-0">
        <CardContent className="p-6 md:p-8">
          <FieldGroup>
            <div className="flex flex-col items-center gap-2 text-center">
              <img src="/logo-color.svg" alt="OpenRift" className="size-12" />
              <Heading level={1}>{m.auth_verify_title()}</Heading>
              <p className="text-muted-foreground text-balance">
                {m.auth_verify_intro_before()} <strong>{email}</strong>
                {m.auth_verify_intro_after()}
              </p>
            </div>
            <Field className="items-center">
              {error && <FieldError>{error}</FieldError>}
              <SixDigitOtpInput
                autoFocusOnMount
                value={otp}
                onChange={setOtp}
                onComplete={(code) => void handleVerify(code)}
              />
            </Field>
            <Field>
              <Button
                className="w-full"
                disabled={otp.length < 6 || verifying}
                onClick={() => void handleVerify(otp)}
              >
                {verifying ? m.auth_verify_verifying() : m.auth_verify_submit()}
              </Button>
              <Button
                type="button"
                variant="link-muted"
                disabled={resending}
                onClick={() => void handleResend()}
              >
                {resending ? m.auth_verify_sending() : m.auth_verify_resend()}
              </Button>
            </Field>
            <p className="text-muted-foreground text-center text-sm">
              <Link
                to="/login"
                search={{ redirect: redirectTo, email: undefined }}
                className="underline underline-offset-2"
              >
                {m.auth_back_to_login()}
              </Link>
            </p>
          </FieldGroup>
        </CardContent>
      </Card>
    </AuthPageLayout>
  );
}
