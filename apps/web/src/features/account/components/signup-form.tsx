import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { z } from "zod/v4";

import { Field, FieldDescription, FieldError, FieldGroup } from "@/components/ui/field";
import { AccountForm, AccountFormSubmit } from "@/features/account/components/account-form";
import { AuthDestinationPanel } from "@/features/account/components/auth-destination-panel";
import { AuthFormCard, SocialAuthButtons } from "@/features/account/components/auth-form-shell";
import { FormInputField } from "@/features/account/components/form-input-field";
import { useAccountForm } from "@/features/account/hooks/use-account-form";
import { displayNameField, newPasswordField } from "@/features/account/lib/account-validation";
import { signUp } from "@/features/account/lib/auth-client";
import { authDestination } from "@/features/account/lib/auth-destination";
import { formText } from "@/features/account/lib/form-data";
import { isPlainClick } from "@/features/account/lib/plain-click";
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
  const form = useAccountForm(signUpSchema());
  const formRef = useRef<HTMLFormElement>(null);
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
      <AccountForm ref={formRef} onInput={form.handleInput} onSubmit={form.handleSubmit(onSubmit)}>
        <FieldGroup>
          {form.errors.root !== undefined && <FieldError>{form.errors.root}</FieldError>}
          <FormInputField
            name="name"
            label={m.auth_field_name()}
            type="text"
            error={form.errors.name}
            placeholder={m.auth_name_placeholder()}
            // oxlint-disable-next-line jsx-a11y/no-autofocus -- sign-up page's primary input
            autoFocus
          />
          <FormInputField
            name="email"
            label={m.auth_field_email()}
            type="email"
            error={form.errors.email}
            defaultValue={initialEmail}
            autoComplete="email"
            placeholder={emailPlaceholder}
          />
          <FormInputField
            name="password"
            label={m.auth_field_password()}
            type="password"
            error={form.errors.password}
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
        {m.auth_signup_have_account()}{" "}
        <LoginLink
          readEmail={() => (formRef.current ? formText(formRef.current, "email").trim() : "")}
          redirectTo={redirectTo}
        />
      </FieldDescription>
    </AuthFormCard>
  );
}

function LoginLink({ readEmail, redirectTo }: { readEmail: () => string; redirectTo?: string }) {
  const navigate = useNavigate();
  return (
    <Link
      rel="nofollow"
      to="/login"
      search={{ redirect: redirectTo, email: undefined }}
      onClick={(event) => {
        if (isPlainClick(event)) {
          event.preventDefault();
          void navigate({
            to: "/login",
            search: { redirect: redirectTo, email: readEmail() || undefined },
          });
        }
      }}
    >
      {m.common_sign_in()}
    </Link>
  );
}
