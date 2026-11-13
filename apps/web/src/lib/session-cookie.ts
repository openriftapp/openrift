// Matches both the dev name and the `__Secure-` prefixed production name.
const SESSION_COOKIE = /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=[^;\s]/u;

export function hasSessionCookie(cookie: string | null | undefined): boolean {
  return cookie !== null && cookie !== undefined && SESSION_COOKIE.test(cookie);
}
