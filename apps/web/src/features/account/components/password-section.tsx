import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { MINUTE_MS } from "@openrift/shared/format-date";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckIcon } from "lucide-react";
import { useState } from "react";
import { z } from "zod/v4";

import { SettingsSection } from "@/components/layout/settings-section";
import { PROSE_MARKUP } from "@/components/message-markup";
import { buttonVariants } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup } from "@/components/ui/field";
import { AccountForm, AccountFormSubmit } from "@/features/account/components/account-form";
import { FormInputField } from "@/features/account/components/form-input-field";
import { useAccountForm } from "@/features/account/hooks/use-account-form";
import { authAccountsKeys } from "@/features/account/lib/account-query-keys";
import { newPasswordField } from "@/features/account/lib/account-validation";
import { authClient } from "@/features/account/lib/auth-client";
import { setServerError } from "@/lib/auth-errors";
import { m } from "@/paraglide/messages.js";

function passwordSchema() {
  return z
    .object({
      currentPassword: z.string().min(1, m.profile_password_error_current_required()),
      newPassword: newPasswordField(m.profile_password_error_new_too_short()),
      confirmPassword: z.string().min(1, m.profile_password_error_confirm_required()),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: m.profile_password_error_mismatch(),
      path: ["confirmPassword"],
    });
}

type PasswordValues = z.infer<ReturnType<typeof passwordSchema>>;

export function PasswordSection({ currentEmail }: { currentEmail: string }) {
  const { data: accounts, isPending } = useQuery({
    queryKey: authAccountsKeys.all,
    queryFn: async () => {
      const { data, error } = await authClient.listAccounts();
      if (error) {
        throw new Error(error.message ?? m.profile_password_accounts_load_failed());
      }
      return data ?? [];
    },
    staleTime: 5 * MINUTE_MS,
  });

  if (isPending) {
    return (
      <SettingsSection title={m.profile_password_title()}>
        <p className="text-muted-foreground text-sm">{m.common_loading()}</p>
      </SettingsSection>
    );
  }

  if (accounts && !accounts.some((account) => account.providerId === "credential")) {
    return <SetPasswordCard currentEmail={currentEmail} />;
  }

  return <ChangePasswordCard />;
}

function SetPasswordCard({ currentEmail }: { currentEmail: string }) {
  return (
    <SettingsSection
      title={m.profile_password_title()}
      description={m.profile_password_set_description()}
    >
      <FieldGroup>
        <FieldDescription>
          <ParaglideMessage
            message={m.profile_password_set_hint}
            inputs={{ email: currentEmail }}
            markup={{ strong: PROSE_MARKUP.strong }}
          />
        </FieldDescription>
        <Field>
          <Link to="/reset-password" search={{ email: currentEmail }} className={buttonVariants()}>
            {m.profile_password_set_cta()}
          </Link>
        </Field>
      </FieldGroup>
    </SettingsSection>
  );
}

function ChangePasswordCard() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const form = useAccountForm(passwordSchema());

  async function onSubmit(values: PasswordValues, formElement: HTMLFormElement) {
    setLoading(true);
    setSuccess(false);
    const result = await authClient
      .changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        revokeOtherSessions: true,
      })
      .catch(() => null);
    setLoading(false);
    if (!result) {
      form.setError("root", { message: m.profile_password_change_failed() });
      return;
    }
    const { error } = result;
    if (error) {
      setServerError(form, error);
      return;
    }
    setSuccess(true);
    formElement.reset();
  }

  return (
    <SettingsSection
      title={m.profile_password_title()}
      description={m.profile_password_change_description()}
    >
      <AccountForm onInput={form.handleInput} onSubmit={form.handleSubmit(onSubmit)}>
        <FieldGroup>
          {form.errors.root !== undefined && <FieldError>{form.errors.root}</FieldError>}
          <FormInputField
            name="currentPassword"
            error={form.errors.currentPassword}
            label={m.profile_password_current_label()}
            type="password"
            autoComplete="current-password"
          />
          <FormInputField
            name="newPassword"
            error={form.errors.newPassword}
            label={m.profile_password_new_label()}
            type="password"
            autoComplete="new-password"
          />
          <FormInputField
            name="confirmPassword"
            error={form.errors.confirmPassword}
            label={m.profile_password_confirm_label()}
            type="password"
            autoComplete="new-password"
          />
          <Field>
            <AccountFormSubmit pending={loading} className="w-full" disabled={loading}>
              {m.profile_password_submit()}
            </AccountFormSubmit>
          </Field>
          {success && (
            <FieldDescription className="flex items-center gap-1.5">
              <CheckIcon className="text-success size-3.5" />
              {m.profile_password_updated()}
            </FieldDescription>
          )}
        </FieldGroup>
      </AccountForm>
    </SettingsSection>
  );
}
