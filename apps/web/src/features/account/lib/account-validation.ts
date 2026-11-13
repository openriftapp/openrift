import { DISPLAY_NAME_PATTERN, MAX_DISPLAY_NAME_LENGTH } from "@openrift/shared/display-name";
import { z } from "zod/v4";

import { m } from "@/paraglide/messages.js";

export const PASSWORD_MIN_LENGTH = 8;
export const OTP_LENGTH = 6;

export function displayNameField() {
  return z
    .string()
    .trim()
    .min(1, m.auth_name_required())
    .max(MAX_DISPLAY_NAME_LENGTH, m.auth_name_too_long())
    .regex(DISPLAY_NAME_PATTERN, m.auth_name_invalid());
}

export function newPasswordField(message: string) {
  return z.string().min(PASSWORD_MIN_LENGTH, message);
}

export function isEmailAddress(text: string): boolean {
  return z.email().safeParse(text.trim()).success;
}
