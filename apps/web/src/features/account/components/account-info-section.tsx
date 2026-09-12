import { zodResolver } from "@hookform/resolvers/zod";
import { validateRiotId } from "@openrift/shared/riot-id";
import { useQueryClient } from "@tanstack/react-query";
import { CheckIcon } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod/v4";

import { SettingsSection } from "@/components/layout/settings-section";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SixDigitOtpInput } from "@/features/account/components/six-digit-otp-input";
import { authClient } from "@/features/account/lib/auth-client";
import { otpErrorMessage, requestOtpErrorMessage, setServerError } from "@/lib/auth-errors";
import { sessionQueryOptions } from "@/lib/auth-session";
import { m } from "@/paraglide/messages.js";

function displayNameSchema() {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, m.profile_account_name_error_required())
      .max(50, m.profile_account_name_error_max())
      .regex(/^[\p{L}\p{N} ._-]+$/u, m.profile_account_name_error_charset()),
  });
}

type DisplayNameValues = z.infer<ReturnType<typeof displayNameSchema>>;

export function AccountInfoSection({
  defaultName,
  defaultRiotId,
  userId,
  currentEmail,
}: {
  defaultName: string;
  defaultRiotId: string;
  userId: string;
  currentEmail: string;
}) {
  return (
    <SettingsSection
      title={m.profile_account_title()}
      description={m.profile_account_description()}
      contentClassName="gap-6"
    >
      <DisplayNameForm defaultName={defaultName} userId={userId} />
      <RiotIdForm defaultRiotId={defaultRiotId} userId={userId} />
      <EmailForm currentEmail={currentEmail} />
    </SettingsSection>
  );
}

function DisplayNameForm({ defaultName, userId }: { defaultName: string; userId: string }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const queryClient = useQueryClient();
  const form = useForm<DisplayNameValues>({
    resolver: zodResolver(displayNameSchema()),
    defaultValues: { name: defaultName },
  });
  // `form.watch()` returns a function React Compiler flags as un-memoizable
  // (IncompatibleLibrary), bailing on the whole component; useWatch does not.
  const watchedName = useWatch({ control: form.control, name: "name" });

  async function onSubmit(values: DisplayNameValues) {
    setLoading(true);
    setSuccess(false);
    const result = await authClient.updateUser({ name: values.name.trim() }).catch(() => null);
    setLoading(false);
    if (!result) {
      form.setError("root", { message: m.profile_account_save_failed() });
      return;
    }
    const { error } = result;
    if (error) {
      setServerError(form, error);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: sessionQueryOptions().queryKey });
    setSuccess(true);
  }

  return (
    <form key={userId} onSubmit={(event) => void form.handleSubmit(onSubmit)(event)} noValidate>
      <FieldGroup>
        {form.formState.errors.root && (
          <FieldError>{form.formState.errors.root.message}</FieldError>
        )}
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>{m.profile_account_name_label()}</FieldLabel>
              <div className="flex gap-2">
                <Input
                  {...field}
                  id={field.name}
                  type="text"
                  placeholder={m.profile_account_name_placeholder()}
                  aria-invalid={fieldState.invalid}
                  className="flex-1"
                />
                <Button type="submit" disabled={loading || watchedName.trim() === defaultName}>
                  {loading ? m.profile_account_saving() : m.profile_account_save()}
                </Button>
              </div>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              {success && (
                <FieldDescription className="flex items-center gap-1.5">
                  <CheckIcon className="text-success size-3.5" />
                  {m.profile_account_name_updated()}
                </FieldDescription>
              )}
            </Field>
          )}
        />
      </FieldGroup>
    </form>
  );
}

const riotIdSchema = z.object({
  riotId: z.string().superRefine((value, ctx) => {
    const result = validateRiotId(value);
    if (!result.ok) {
      ctx.addIssue({ code: "custom", message: result.reason });
    }
  }),
});

type RiotIdValues = z.infer<typeof riotIdSchema>;

function RiotIdForm({ defaultRiotId, userId }: { defaultRiotId: string; userId: string }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const queryClient = useQueryClient();
  const form = useForm<RiotIdValues>({
    resolver: zodResolver(riotIdSchema),
    defaultValues: { riotId: defaultRiotId },
  });
  const watchedRiotId = useWatch({ control: form.control, name: "riotId" });

  async function onSubmit(values: RiotIdValues) {
    setLoading(true);
    setSuccess(false);
    // An empty string normalizes to null server-side (clears the field).
    const result = await authClient.updateUser({ riotId: values.riotId.trim() }).catch(() => null);
    setLoading(false);
    if (!result) {
      form.setError("root", { message: m.profile_account_save_failed() });
      return;
    }
    const { error } = result;
    if (error) {
      setServerError(form, error);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: sessionQueryOptions().queryKey });
    setSuccess(true);
  }

  return (
    <form key={userId} onSubmit={(event) => void form.handleSubmit(onSubmit)(event)} noValidate>
      <FieldGroup>
        {form.formState.errors.root && (
          <FieldError>{form.formState.errors.root.message}</FieldError>
        )}
        <Controller
          name="riotId"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>{m.profile_account_riot_label()}</FieldLabel>
              <div className="flex gap-2">
                <Input
                  {...field}
                  id={field.name}
                  type="text"
                  placeholder="SummonerName#EUW"
                  aria-invalid={fieldState.invalid}
                  className="flex-1"
                />
                <Button type="submit" disabled={loading || watchedRiotId.trim() === defaultRiotId}>
                  {loading ? m.profile_account_saving() : m.profile_account_save()}
                </Button>
              </div>
              <FieldDescription>{m.profile_account_riot_description()}</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              {success && (
                <FieldDescription className="flex items-center gap-1.5">
                  <CheckIcon className="text-success size-3.5" />
                  {m.profile_account_riot_updated()}
                </FieldDescription>
              )}
            </Field>
          )}
        />
      </FieldGroup>
    </form>
  );
}

function EmailForm({ currentEmail }: { currentEmail: string }) {
  const [step, setStep] = useState<"input" | "verify-current" | "verify-new">("input");
  const [newEmail, setNewEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [success, setSuccess] = useState(false);
  const queryClient = useQueryClient();

  function resetFlow() {
    setStep("input");
    setNewEmail("");
    setOtp("");
    setError("");
    setSuccess(false);
  }

  async function handleSendToCurrentEmail() {
    const trimmed = newEmail.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setError(m.profile_account_email_invalid());
      return;
    }
    setError("");
    setLoading(true);
    const result = await authClient.emailOtp
      .sendVerificationOtp({ email: currentEmail, type: "email-verification" })
      .catch(() => null);
    setLoading(false);
    if (!result) {
      setError(m.profile_account_send_failed());
      return;
    }
    if (result.error) {
      setError(requestOtpErrorMessage(result.error));
      return;
    }
    setStep("verify-current");
  }

  async function handleVerifyCurrentEmail() {
    if (otp.length < 6) {
      return;
    }
    setLoading(true);
    setError("");
    const result = await authClient.emailOtp
      .requestEmailChange({ newEmail: newEmail.trim(), otp })
      .catch(() => null);
    setLoading(false);
    if (!result) {
      setError(m.profile_account_verify_failed());
      return;
    }
    if (result.error) {
      setError(otpErrorMessage(result.error));
      return;
    }
    setOtp("");
    setStep("verify-new");
  }

  async function handleVerifyNewEmail() {
    if (otp.length < 6) {
      return;
    }
    setLoading(true);
    setError("");
    const result = await authClient.emailOtp
      .changeEmail({ newEmail: newEmail.trim(), otp })
      .catch(() => null);
    setLoading(false);
    if (!result) {
      setError(m.profile_account_verify_failed());
      return;
    }
    if (result.error) {
      setError(otpErrorMessage(result.error));
      return;
    }
    await queryClient.invalidateQueries({ queryKey: sessionQueryOptions().queryKey });
    setSuccess(true);
    setStep("input");
    setNewEmail("");
    setOtp("");
  }

  // The verify-new step's OTP is minted by requestEmailChange, which consumes
  // the current-email OTP; only that step can resend.
  async function handleResend() {
    setResending(true);
    setError("");
    const result = await authClient.emailOtp
      .sendVerificationOtp({ email: currentEmail, type: "email-verification" })
      .catch(() => null);
    setResending(false);
    if (!result) {
      setError(m.profile_account_send_failed());
      return;
    }
    if (result.error) {
      setError(requestOtpErrorMessage(result.error));
    }
  }

  return (
    <FieldGroup>
      <FieldLabel>
        {m.profile_account_email_label()}{" "}
        <span className="text-muted-foreground font-normal">({currentEmail})</span>
      </FieldLabel>
      {error && <FieldError>{error}</FieldError>}
      {success && (
        <FieldDescription className="flex items-center gap-1.5">
          <CheckIcon className="text-success size-3.5" />
          {m.profile_account_email_updated()}
        </FieldDescription>
      )}

      {step === "input" && (
        <Field>
          <FieldLabel htmlFor="new-email">{m.profile_account_new_email_label()}</FieldLabel>
          <div className="flex gap-2">
            <Input
              id="new-email"
              type="email"
              autoComplete="email"
              placeholder={currentEmail}
              value={newEmail}
              onChange={(e) => {
                setNewEmail(e.target.value);
                setSuccess(false);
              }}
              className="flex-1"
            />
            <Button
              disabled={loading || !newEmail.trim()}
              onClick={() => void handleSendToCurrentEmail()}
            >
              {loading ? m.profile_account_sending() : m.profile_account_send_code()}
            </Button>
          </div>
        </Field>
      )}

      {step === "verify-current" && (
        <>
          <p className="text-muted-foreground text-sm">
            {m.profile_account_otp_sent_to()} <strong>{currentEmail}</strong>.
          </p>
          <div className="flex justify-center">
            <SixDigitOtpInput value={otp} onChange={setOtp} />
          </div>
          <Field>
            <Button
              disabled={otp.length < 6 || loading}
              onClick={() => void handleVerifyCurrentEmail()}
            >
              {loading ? m.profile_account_verifying() : m.profile_account_verify()}
            </Button>
          </Field>
          <div className="flex justify-center gap-4">
            <Button
              type="button"
              variant="link-muted"
              className="h-auto px-0 text-sm"
              disabled={resending}
              onClick={() => void handleResend()}
            >
              {resending ? m.profile_account_sending() : m.profile_account_resend()}
            </Button>
            <Button
              type="button"
              variant="link-muted"
              className="h-auto px-0 text-sm"
              onClick={resetFlow}
            >
              {m.profile_account_cancel()}
            </Button>
          </div>
        </>
      )}

      {step === "verify-new" && (
        <>
          <p className="text-muted-foreground text-sm">
            {m.profile_account_otp_sent_to()} <strong>{newEmail.trim()}</strong>.
          </p>
          <div className="flex justify-center">
            <SixDigitOtpInput value={otp} onChange={setOtp} />
          </div>
          <Field>
            <Button
              disabled={otp.length < 6 || loading}
              onClick={() => void handleVerifyNewEmail()}
            >
              {loading ? m.profile_account_confirming() : m.profile_account_confirm()}
            </Button>
          </Field>
          <div className="flex justify-center">
            <Button
              type="button"
              variant="link-muted"
              className="h-auto px-0 text-sm"
              onClick={resetFlow}
            >
              {m.profile_account_cancel()}
            </Button>
          </div>
        </>
      )}
    </FieldGroup>
  );
}
