import { validateRiotId } from "@openrift/shared/riot-id";
import { useQueryClient } from "@tanstack/react-query";
import { CheckIcon } from "lucide-react";
import { useState } from "react";
import { z } from "zod/v4";

import { SettingsSection } from "@/components/layout/settings-section";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AccountForm, AccountFormSubmit } from "@/features/account/components/account-form";
import { SixDigitOtpInput } from "@/features/account/components/six-digit-otp-input";
import { useAccountForm } from "@/features/account/hooks/use-account-form";
import { useFieldDraft } from "@/features/account/hooks/use-field-draft";
import { useUpdateUserField } from "@/features/account/hooks/use-update-user-field";
import {
  displayNameField,
  isEmailAddress,
  OTP_LENGTH,
} from "@/features/account/lib/account-validation";
import { authClient } from "@/features/account/lib/auth-client";
import { formText } from "@/features/account/lib/form-data";
import { otpErrorMessage, requestOtpErrorMessage } from "@/lib/auth-errors";
import { sessionQueryOptions } from "@/lib/auth-session";
import { m } from "@/paraglide/messages.js";

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
      <SavedTextForm
        key={`name:${userId}`}
        field="name"
        schema={z.object({ name: displayNameField() })}
        savedValue={defaultName}
        label={m.profile_account_name_label()}
        placeholder={m.profile_account_name_placeholder()}
        updated={m.profile_account_name_updated()}
      />
      <SavedTextForm
        key={`riotId:${userId}`}
        field="riotId"
        schema={riotIdSchema}
        savedValue={defaultRiotId}
        label={m.profile_account_riot_label()}
        placeholder="SummonerName#EUW"
        description={m.profile_account_riot_description()}
        updated={m.profile_account_riot_updated()}
      />
      <EmailForm currentEmail={currentEmail} />
    </SettingsSection>
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

function SavedTextForm({
  field,
  schema,
  savedValue,
  label,
  placeholder,
  description,
  updated,
}: {
  field: "name" | "riotId";
  schema: z.ZodType<Record<string, string>>;
  savedValue: string;
  label: string;
  placeholder: string;
  description?: string;
  updated: string;
}) {
  const form = useAccountForm(schema);
  const { ref: fieldRef, draft, handleInput: handleDraftInput } = useFieldDraft<HTMLInputElement>();
  const { save, loading, success } = useUpdateUserField(form, {
    saveFailed: m.profile_account_save_failed(),
  });
  const error = form.errors[field];

  async function onSubmit(values: Record<string, string>) {
    // An empty Riot ID normalizes to null server-side (clears the field).
    const value = (values[field] ?? "").trim();
    await save(field === "name" ? { name: value } : { riotId: value });
  }

  return (
    <AccountForm onInput={form.handleInput} onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup>
        {form.errors.root !== undefined && <FieldError>{form.errors.root}</FieldError>}
        <Field data-invalid={error !== undefined}>
          <FieldLabel htmlFor={field}>{label}</FieldLabel>
          <div className="flex gap-2">
            <Input
              ref={fieldRef}
              id={field}
              name={field}
              type="text"
              autoComplete="off"
              defaultValue={savedValue}
              placeholder={placeholder}
              aria-invalid={error !== undefined}
              className="flex-1"
              onInput={handleDraftInput}
            />
            <AccountFormSubmit
              pending={loading}
              disabled={loading || draft === undefined || draft.trim() === savedValue}
            >
              {m.common_save()}
            </AccountFormSubmit>
          </div>
          {description !== undefined && <FieldDescription>{description}</FieldDescription>}
          {error !== undefined && <FieldError>{error}</FieldError>}
          {success && (
            <FieldDescription className="flex items-center gap-1.5">
              <CheckIcon className="text-success size-3.5" />
              {updated}
            </FieldDescription>
          )}
        </Field>
      </FieldGroup>
    </AccountForm>
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

  async function handleSendToCurrentEmail(form: HTMLFormElement) {
    const trimmed = formText(form, "newEmail").trim();
    if (!isEmailAddress(trimmed)) {
      setError(m.profile_account_email_invalid());
      return;
    }
    setError("");
    setNewEmail(trimmed);
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
    if (otp.length < OTP_LENGTH) {
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
    if (otp.length < OTP_LENGTH) {
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

  /**
   * The verify-new step's OTP is minted by requestEmailChange, which consumes
   * the current-email OTP; only that step can resend.
   */
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
        <AccountForm
          onInput={() => setSuccess(false)}
          onSubmit={(event) => void handleSendToCurrentEmail(event.currentTarget)}
        >
          <Field>
            <FieldLabel htmlFor="new-email">{m.profile_account_new_email_label()}</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="new-email"
                name="newEmail"
                type="email"
                autoComplete="email"
                placeholder={currentEmail}
                className="flex-1"
              />
              <AccountFormSubmit pending={loading} disabled={loading}>
                {m.profile_account_send_code()}
              </AccountFormSubmit>
            </div>
          </Field>
        </AccountForm>
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
              pending={loading}
              disabled={otp.length < OTP_LENGTH || loading}
              onClick={() => void handleVerifyCurrentEmail()}
            >
              {m.profile_account_verify()}
            </Button>
          </Field>
          <div className="flex justify-center gap-4">
            <Button
              pending={resending}
              type="button"
              variant="link-muted"
              className="h-auto px-0"
              disabled={resending}
              onClick={() => void handleResend()}
            >
              {m.profile_account_resend()}
            </Button>
            <Button type="button" variant="link-muted" className="h-auto px-0" onClick={resetFlow}>
              {m.common_cancel()}
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
              pending={loading}
              disabled={otp.length < OTP_LENGTH || loading}
              onClick={() => void handleVerifyNewEmail()}
            >
              {m.profile_account_confirm()}
            </Button>
          </Field>
          <div className="flex justify-center">
            <Button type="button" variant="link-muted" className="h-auto px-0" onClick={resetFlow}>
              {m.common_cancel()}
            </Button>
          </div>
        </>
      )}
    </FieldGroup>
  );
}
