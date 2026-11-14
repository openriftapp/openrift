import { check, sleep } from "k6";
import http from "k6/http";

import { BASE_URL } from "./config.js";
import { pick } from "./setup.js";

export const SESSION_COOKIE = __ENV.LOADTEST_SESSION_COOKIE;
if (!SESSION_COOKIE) {
  throw new Error(
    "LOADTEST_SESSION_COOKIE is required. Sign in on the target host in a browser, copy the session cookie value, and pass it via env.",
  );
}
export const COOKIE_NAME = __ENV.COOKIE_NAME ?? "__Secure-better-auth.session_token";

export function authedParams(name) {
  return {
    tags: { name },
    cookies: { [COOKIE_NAME]: SESSION_COOKIE },
  };
}

// A bad cookie silently runs the whole test against the anonymous edge path.
export function probeSession() {
  const probe = http.get(`${BASE_URL}/api/auth/get-session`, {
    cookies: { [COOKIE_NAME]: SESSION_COOKIE },
  });
  if (probe.status !== 200) {
    throw new Error(
      `Session cookie probe failed: ${probe.status} — check LOADTEST_SESSION_COOKIE and COOKIE_NAME.`,
    );
  }
  const session = probe.json();
  if (!session || !session.user) {
    throw new Error("Session cookie probe returned no user — cookie is invalid or expired.");
  }
  console.log(`Authed as ${session.user.email}`);
  return session;
}

export function authedJourney(data) {
  http.get(`${BASE_URL}/cards`, authedParams("cards_page"));
  http.get(`${BASE_URL}/api/auth/get-session`, authedParams("get_session"));
  sleep(Math.random() * 3 + 2);

  const cardSlug = pick(data.cardSlugs);
  const detail = http.get(`${BASE_URL}/cards/${cardSlug}`, authedParams("card_detail_page"));
  check(detail, { "card detail ok": (r) => r.status === 200 });
  sleep(Math.random() * 3 + 2);

  const collections = http.get(`${BASE_URL}/collections`, authedParams("collections_page"));
  check(collections, { "collections ok": (r) => r.status === 200 });
  sleep(Math.random() * 3 + 2);

  const decks = http.get(`${BASE_URL}/decks`, authedParams("decks_page"));
  check(decks, { "decks ok": (r) => r.status === 200 });
  sleep(Math.random() * 3 + 2);

  http.get(`${BASE_URL}/cards`, authedParams("cards_page"));
  sleep(Math.random() * 2 + 1);
}
