type EventData = Record<string, string | number>;

declare global {
  var umami: { track: (eventName: string, eventData?: EventData) => void } | undefined;
}

export type SignupMethod = "email" | "email-code" | "google" | "discord";

const MAX_QUEUED_EVENTS = 20;
const FIRST_TOUCH_KEY = "openrift:first-touch";
const SIGNUP_CTA_KEY = "openrift:signup-cta";
export const SOCIAL_SIGNUP_PARAM = "signup";

const queuedEvents: { name: string; data?: EventData }[] = [];

export function trackEvent(name: string, data?: EventData) {
  if (globalThis.umami) {
    globalThis.umami.track(name, data);
    return;
  }
  if (queuedEvents.length < MAX_QUEUED_EVENTS) {
    queuedEvents.push({ name, data });
  }
}

export function flushQueuedEvents() {
  const umami = globalThis.umami;
  if (!umami) {
    return;
  }
  for (const { name, data } of queuedEvents.splice(0)) {
    umami.track(name, data);
  }
}

export function routeTemplate(
  href: string | undefined,
  matchRoutes: (pathname: string) => readonly { routeId: string; fullPath: string }[],
): string {
  if (!href) {
    return "none";
  }
  const { pathname } = new URL(href, "http://localhost");
  const match = matchRoutes(pathname).at(-1);
  return match && match.routeId !== "__root__" ? match.fullPath : "not-found";
}

export function firstTouchSource({
  search,
  referrer,
  host,
}: {
  search: string;
  referrer: string;
  host: string;
}): string {
  const utmSource = new URLSearchParams(search).get("utm_source");
  if (utmSource) {
    return utmSource;
  }
  if (!referrer) {
    return "direct";
  }
  try {
    const referrerHost = new URL(referrer).host;
    return referrerHost === host ? "direct" : referrerHost;
  } catch {
    return "direct";
  }
}

function readStorage(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(storage: () => Storage, key: string, value: string | null) {
  try {
    if (value === null) {
      storage().removeItem(key);
    } else {
      storage().setItem(key, value);
    }
  } catch {
    // Storage is unavailable in private windows or with blocked site data.
  }
}

export function recordFirstTouch(touch: { path: string; source: string }) {
  if (readStorage(() => localStorage, FIRST_TOUCH_KEY) === null) {
    writeStorage(() => localStorage, FIRST_TOUCH_KEY, JSON.stringify(touch));
  }
}

function readFirstTouch(): { path: string; source: string } | undefined {
  const raw = readStorage(() => localStorage, FIRST_TOUCH_KEY);
  if (!raw) {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "path" in parsed &&
    "source" in parsed &&
    typeof parsed.path === "string" &&
    typeof parsed.source === "string"
  ) {
    return { path: parsed.path, source: parsed.source };
  }
  return undefined;
}

export function trackSignupCta(source: string) {
  writeStorage(() => sessionStorage, SIGNUP_CTA_KEY, source);
  trackEvent("signup-cta", { source });
}

export function trackSignupPromptView(source: string) {
  trackEvent("signup-prompt-view", { source });
}

export function trackAuthGate(feature: string) {
  trackEvent("auth-gate", { feature });
}

function signupData(method: SignupMethod, from: string): EventData {
  const firstTouch = readFirstTouch();
  return {
    method,
    from,
    cta: readStorage(() => sessionStorage, SIGNUP_CTA_KEY) ?? "none",
    first_path: firstTouch?.path ?? "unknown",
    first_source: firstTouch?.source ?? "unknown",
  };
}

export function trackSignupSubmit(method: SignupMethod, from: string) {
  trackEvent("signup-submit", signupData(method, from));
}

export function trackSignupComplete(method: SignupMethod, from: string) {
  trackEvent("signup-verified", signupData(method, from));
  writeStorage(() => sessionStorage, SIGNUP_CTA_KEY, null);
}

/** Better Auth sends brand-new OAuth users here instead of `callbackURL`. */
export function socialNewUserCallbackURL(callbackURL: string, method: SignupMethod): string {
  const url = new URL(callbackURL, "http://localhost");
  url.searchParams.set(SOCIAL_SIGNUP_PARAM, method);
  return `${url.pathname}${url.search}${url.hash}`;
}

const NEW_ACCOUNT_WINDOW_MS = 10 * 60 * 1000;

/** Code sign-in creates the account on first use; the response carries no flag, so a fresh `createdAt` stands in. */
export function isNewAccount(createdAt: string | Date, now = Date.now()): boolean {
  const created = new Date(createdAt).getTime();
  return Number.isFinite(created) && now - created < NEW_ACCOUNT_WINDOW_MS;
}

export function parseSignupMethod(value: string | null): SignupMethod | undefined {
  return value === "google" || value === "discord" || value === "email" ? value : undefined;
}
