import type { UseFormSetError } from "react-hook-form";

import { m } from "@/paraglide/messages.js";

function codeToField(): Record<
  string,
  { field?: "email" | "password" | "name" | "currentPassword" | "otp" | "root"; message: string }
> {
  return {
    INVALID_ORIGIN: { field: "root", message: m.auth_error_invalid_origin() },
    INVALID_EMAIL: { field: "email", message: m.auth_error_invalid_email() },
    PASSWORD_TOO_SHORT: { field: "password", message: m.auth_error_password_too_short() },
    PASSWORD_TOO_LONG: { field: "password", message: m.auth_error_password_too_long() },
    INVALID_PASSWORD: { field: "currentPassword", message: m.auth_error_invalid_password() },
    INVALID_EMAIL_OR_PASSWORD: { field: "root", message: m.auth_error_invalid_email_or_password() },
    USER_ALREADY_EXISTS: { field: "email", message: m.auth_error_user_already_exists() },
    USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: {
      field: "email",
      message: m.auth_error_user_already_exists(),
    },
    EMAIL_NOT_VERIFIED: { field: "root", message: m.auth_error_email_not_verified() },
    NEW_EMAIL_SAME_AS_OLD: { field: "email", message: m.auth_error_new_email_same_as_old() },
    INVALID_NAME: { field: "name", message: m.auth_error_invalid_name() },
    OTP_EXPIRED: { field: "otp", message: m.auth_error_otp_expired() },
    INVALID_OTP: { field: "otp", message: m.auth_error_invalid_otp() },
    TOO_MANY_ATTEMPTS: { field: "otp", message: m.auth_error_too_many_attempts() },
  };
}

const BODY_FIELD_RE = /^\[body\.(?<field>\w+)\]\s*(?<text>.+)$/u;

export function setServerError(
  // oxlint-disable-next-line no-explicit-any -- generic over any form shape
  form: { setError: UseFormSetError<any> },
  error: { code?: string; message?: string },
) {
  const mapped = error.code === undefined ? undefined : codeToField()[error.code];
  if (mapped) {
    form.setError(mapped.field ?? "root", { message: mapped.message });
    return;
  }

  if (error.message) {
    const match = BODY_FIELD_RE.exec(error.message);
    if (match) {
      const [, field, text] = match;
      if (
        field === "email" ||
        field === "password" ||
        field === "name" ||
        field === "currentPassword" ||
        field === "otp"
      ) {
        form.setError(field, { message: text });
        return;
      }
    }
  }

  form.setError("root", {
    message: error.message ?? m.auth_error_generic(),
  });
}

/** A delivery (SMTP) failure is swallowed server-side and returns success, so it never reaches here. */
export function requestOtpErrorMessage(error: { code?: string; status?: number }): string {
  if (error.status === 429) {
    return m.auth_error_too_many_requests();
  }
  if (error.code === "INVALID_EMAIL") {
    return m.auth_error_invalid_email();
  }
  return m.auth_error_send_code_failed();
}

const OTP_ERROR_CODES = new Set(["OTP_EXPIRED", "INVALID_OTP", "TOO_MANY_ATTEMPTS"]);

export function otpErrorMessage(error: { code?: string; message?: string }): string {
  const mapped =
    error.code !== undefined && OTP_ERROR_CODES.has(error.code)
      ? codeToField()[error.code]
      : undefined;
  if (mapped) {
    return mapped.message;
  }
  return error.message ?? m.auth_error_generic();
}
