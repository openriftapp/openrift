import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import type { Control } from "react-hook-form";
import { useForm, useFormState, useWatch } from "react-hook-form";
import { z } from "zod/v4";

import { Field, FieldDescription, FieldError, FieldGroup } from "@/components/ui/field";
import { AccountForm, AccountFormSubmit } from "@/features/account/components/account-form";
import { AuthDestinationPanel } from "@/features/account/components/auth-destination-panel";
import { AuthFormCard, SocialAuthButtons } from "@/features/account/components/auth-form-shell";
import { FormInputField } from "@/features/account/components/form-input-field";
import { displayNameField, newPasswordField } from "@/features/account/lib/account-validation";
import { signUp } from "@/features/account/lib/auth-client";
import { authDestination } from "@/features/account/lib/auth-destination";
import { routeTemplate, trackSignupSubmit } from "@/lib/analytics";
import { setServerError } from "@/lib/auth-errors";
import { m } from "@/paraglide/messages.js";

function signUpSchema() {
  return z.object({
    name: displayNameField(),
    email: z.email(m.auth_invalid_email()),
    password: newPasswordField(m.auth_password_min()),
  });
}

type SignUpValues = z.infer<ReturnType<typeof signUpSchema>>;

export function SignupForm({
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
  const navigate = useNavigate();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema()),
    defaultValues: { name: "", email: initialEmail, password: "" },
  });
  const destination = authDestination(redirectTo);

  async function onSubmit(values: SignUpValues) {
    setLoading(true);
    const result = await signUp.email(values).catch(() => null);
    setLoading(false);
    if (!result) {
      form.setError("root", { message: m.auth_signup_failed() });
      return;
    }
    const { error } = result;
    if (error) {
      setServerError(form, error);
      return;
    }
    trackSignupSubmit(
      "email",
      routeTemplate(redirectTo, (pathname) => router.matchRoutes(pathname)),
    );
    void navigate({ to: "/verify-email", search: { email: values.email, redirect: redirectTo } });
  }

  return (
    <AuthFormCard
      className={className}
      title={m.auth_signup_title()}
      subtitle={m.auth_signup_subtitle()}
      aside={destination && <AuthDestinationPanel destination={destination} />}
      {...props}
    >
      <AccountForm onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}>
        <FieldGroup>
          <RootFormError control={form.control} />
          <FormInputField
            control={form.control}
            name="name"
            label={m.auth_field_name()}
            type="text"
            placeholder={m.auth_name_placeholder()}
            // oxlint-disable-next-line jsx-a11y/no-autofocus -- sign-up page's primary input
            autoFocus
          />
          <FormInputField
            control={form.control}
            name="email"
            label={m.auth_field_email()}
            type="email"
            autoComplete="email"
            placeholder={emailPlaceholder}
          />
          <FormInputField
            control={form.control}
            name="password"
            label={m.auth_field_password()}
            type="password"
            autoComplete="new-password"
          />
          <Field>
            <AccountFormSubmit pending={loading} className="w-full" disabled={loading}>
              {m.common_sign_up()}
            </AccountFormSubmit>
          </Field>
        </FieldGroup>
      </AccountForm>
      <SocialAuthButtons redirectTo={redirectTo} />
      <FieldDescription className="text-center">
        {m.auth_signup_have_account()} <LoginLink control={form.control} redirectTo={redirectTo} />
      </FieldDescription>
    </AuthFormCard>
  );
}

function RootFormError({ control }: { control: Control<SignUpValues> }) {
  const { errors } = useFormState({ control });
  return errors.root ? <FieldError>{errors.root.message}</FieldError> : null;
}

/**
 * Isolated so the watch re-renders this link, not the whole card. Uses
 * `useWatch`, not `form.watch()`: the latter bails out the React Compiler.
 */
function LoginLink({
  control,
  redirectTo,
}: {
  control: Control<SignUpValues>;
  redirectTo?: string;
}) {
  const email = useWatch({ control, name: "email" });
  return (
    <Link rel="nofollow" to="/login" search={{ redirect: redirectTo, email: email || undefined }}>
      {m.common_sign_in()}
    </Link>
  );
}
