import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckIcon } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod/v4";

import { SettingsSection } from "@/components/layout/settings-section";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/features/account/lib/auth-client";
import { setServerError } from "@/lib/auth-errors";
import { m } from "@/paraglide/messages.js";

function passwordSchema() {
  return z
    .object({
      currentPassword: z.string().min(1, m.profile_password_error_current_required()),
      newPassword: z.string().min(8, m.profile_password_error_new_too_short()),
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
    queryKey: ["auth", "accounts"],
    queryFn: async () => {
      const { data, error } = await authClient.listAccounts();
      if (error) {
        throw new Error(error.message ?? m.profile_password_accounts_load_failed());
      }
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isPending) {
    return (
      <SettingsSection title={m.profile_password_title()}>
        <p className="text-muted-foreground text-sm">{m.profile_password_loading()}</p>
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
          {m.profile_password_set_hint_before()} <strong>{currentEmail}</strong>
          {m.profile_password_set_hint_after()}
        </FieldDescription>
        <Field>
          <Button render={<Link to="/reset-password" search={{ email: currentEmail }} />}>
            {m.profile_password_set_cta()}
          </Button>
        </Field>
      </FieldGroup>
    </SettingsSection>
  );
}

function ChangePasswordCard() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema()),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(values: PasswordValues) {
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
    form.reset();
  }

  return (
    <SettingsSection
      title={m.profile_password_title()}
      description={m.profile_password_change_description()}
    >
      <form onSubmit={(event) => void form.handleSubmit(onSubmit)(event)} noValidate>
        <FieldGroup>
          {form.formState.errors.root && (
            <FieldError>{form.formState.errors.root.message}</FieldError>
          )}
          <Controller
            name="currentPassword"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{m.profile_password_current_label()}</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="newPassword"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{m.profile_password_new_label()}</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Controller
            name="confirmPassword"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{m.profile_password_confirm_label()}</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <Field>
            <Button type="submit" disabled={loading}>
              {loading ? m.profile_password_submit_pending() : m.profile_password_submit()}
            </Button>
          </Field>
          {success && (
            <FieldDescription className="flex items-center gap-1.5">
              <CheckIcon className="text-success size-3.5" />
              {m.profile_password_updated()}
            </FieldDescription>
          )}
        </FieldGroup>
      </form>
    </SettingsSection>
  );
}
