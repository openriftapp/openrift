import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { useHydrated } from "@/hooks/use-hydrated";
import { m } from "@/paraglide/messages.js";

/**
 * Before hydration the browser submits natively: `post` keeps the fields out of the URL,
 * and the page route renders without reading the body.
 */
export function AccountForm({
  onSubmit,
  children,
  ...props
}: Omit<ComponentProps<"form">, "method" | "action">) {
  return (
    <form
      noValidate
      {...props}
      method="post"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(event);
      }}
    >
      <noscript>
        <FieldError>{m.auth_needs_javascript()}</FieldError>
      </noscript>
      {children}
    </form>
  );
}

/** Button drops `disabled` from server HTML, so a native fieldset blocks the pre-hydration submit. */
export function AccountFormSubmit(props: Omit<ComponentProps<typeof Button>, "type">) {
  const hydrated = useHydrated();
  return (
    <fieldset disabled={!hydrated} className="contents">
      <Button {...props} type="submit" />
    </fieldset>
  );
}
