const SECRET_FIELDS: ReadonlySet<string> = new Set([
  "password",
  "currentPassword",
  "newPassword",
  "confirmPassword",
]);

const FORM_FIELDS: ReadonlySet<string> = new Set([...SECRET_FIELDS, "email", "name"]);

const LOCAL_BASE = "http://local";

/**
 * A query carrying a secret came from a native form submit and loses every form field, also
 * inside a nested `redirect` target. Any other path comes back unchanged.
 */
export function withoutSubmittedFields(href: string): string {
  if (!href.includes("?")) {
    return href;
  }
  const url = new URL(href, LOCAL_BASE);
  const params = url.searchParams;
  const keys = [...params.keys()];
  const secret = keys.some((key) => SECRET_FIELDS.has(key));
  const nested = params.get("redirect");
  const cleanedNested = nested === null ? null : withoutSubmittedFields(nested);
  if (!secret && cleanedNested === nested) {
    return href;
  }
  if (secret) {
    for (const key of keys) {
      if (FORM_FIELDS.has(key)) {
        params.delete(key);
      }
    }
  }
  if (cleanedNested !== null && params.has("redirect")) {
    params.set("redirect", cleanedNested);
  }
  const query = params.toString();
  return `${url.pathname}${query ? `?${query}` : ""}${url.hash}`;
}
