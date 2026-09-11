export const PROFILE_BIO_MAX_LENGTH = 200;

export const PROFILE_BIO_FORMAT_MESSAGE = `Keep the bio to one line of at most ${PROFILE_BIO_MAX_LENGTH} characters.`;

type ValidateProfileBioResult = { ok: true; value: string | null } | { ok: false; reason: string };

export function validateProfileBio(input: unknown): ValidateProfileBioResult {
  if (input === null || input === undefined) {
    return { ok: true, value: null };
  }
  if (typeof input !== "string") {
    return { ok: false, reason: PROFILE_BIO_FORMAT_MESSAGE };
  }
  const collapsed = input.replaceAll(/\s+/gu, " ").trim();
  if (collapsed.length === 0) {
    return { ok: true, value: null };
  }
  if (collapsed.length > PROFILE_BIO_MAX_LENGTH) {
    return { ok: false, reason: PROFILE_BIO_FORMAT_MESSAGE };
  }
  return { ok: true, value: collapsed };
}
