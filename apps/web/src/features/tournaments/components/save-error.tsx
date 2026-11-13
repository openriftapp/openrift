import { FieldError } from "@/components/ui/field";
import { errorText } from "@/lib/error-text";
import { m } from "@/paraglide/messages.js";

export function SaveError({ error }: { error: unknown }) {
  if (error === null || error === undefined) {
    return null;
  }
  return <FieldError>{errorText(error, m.common_error_generic())}</FieldError>;
}
