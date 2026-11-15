import { hasSessionCookie } from "@/lib/session-cookie";

export const DISPLAY_LANGUAGES_COOKIE = "display-languages";

const MAX_LANGUAGES = 16;
const MAX_RAW_LENGTH = 192;
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;
const OWNER_SEPARATOR = "|";

/** Null when the value is missing, oversized or names no known language. */
export function parseDisplayLanguages(
  raw: string | null | undefined,
  knownCodes: ReadonlySet<string>,
): readonly string[] | null {
  if (!raw || raw.length > MAX_RAW_LENGTH) {
    return null;
  }
  const codes = raw.slice(raw.indexOf(OWNER_SEPARATOR) + 1).split(",");
  const known = [...new Set(codes)].filter((code) => knownCodes.has(code));
  return known.length > 0 ? known.slice(0, MAX_LANGUAGES) : null;
}

function readCookie(cookieHeader: string, name: string): string | undefined {
  const value = new RegExp(`(?:^|;\\s*)${name}=([^;]*)`, "u").exec(cookieHeader)?.[1];
  if (value === undefined) {
    return undefined;
  }
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

/** A request without a session reads as no languages, so anonymous HTML never depends on the cookie. */
export function viewerDisplayLanguages(
  cookieHeader: string | null | undefined,
  knownCodes: ReadonlySet<string>,
): readonly string[] | null {
  if (!hasSessionCookie(cookieHeader) || !cookieHeader) {
    return null;
  }
  return parseDisplayLanguages(readCookie(cookieHeader, DISPLAY_LANGUAGES_COOKIE), knownCodes);
}

let released = false;

function cookieOwner(): string | null {
  const raw = readCookie(document.cookie, DISPLAY_LANGUAGES_COOKIE);
  if (!raw) {
    return null;
  }
  const separator = raw.indexOf(OWNER_SEPARATOR);
  return separator === -1 ? "" : raw.slice(0, separator);
}

/** Drops a cookie another account wrote; null (signed out) lets the next sign-in write again. */
export function claimDisplayLanguagesCookie(userId: string | null): void {
  if (typeof document === "undefined") {
    return;
  }
  if (userId === null) {
    released = false;
    return;
  }
  const owner = cookieOwner();
  if (owner !== null && owner !== userId) {
    clearDisplayLanguagesCookie();
  }
}

/** Sign-out: clears the cookie and refuses writes until the session is gone. */
export function releaseDisplayLanguagesCookie(): void {
  released = true;
  clearDisplayLanguagesCookie();
}

export function writeDisplayLanguagesCookie(userId: string, languages: readonly string[]): void {
  if (typeof document === "undefined" || released) {
    return;
  }
  if (languages.length === 0) {
    clearDisplayLanguagesCookie();
    return;
  }
  const value = encodeURIComponent(
    `${userId}${OWNER_SEPARATOR}${languages.slice(0, MAX_LANGUAGES).join(",")}`,
  );
  const secure = globalThis.location?.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${DISPLAY_LANGUAGES_COOKIE}=${value}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;
}

export function clearDisplayLanguagesCookie(): void {
  if (typeof document === "undefined") {
    return;
  }
  document.cookie = `${DISPLAY_LANGUAGES_COOKIE}=; path=/; max-age=0`;
}
