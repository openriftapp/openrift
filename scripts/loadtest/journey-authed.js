// Every request carries a real session cookie so Cloudflare bypasses its
// edge cache and every page hits origin SSR, the traffic anonymous tests
// can't measure. Get LOADTEST_SESSION_COOKIE by signing in on the target
// host and copying __Secure-better-auth.session_token; pass it (and
// BASE_URL) via env.

import { probeSession } from "./lib/session.js";
import { fetchSlugs } from "./lib/setup.js";

export const options = {
  stages: [
    { duration: "1m", target: 20 },
    { duration: "2m", target: 50 },
    { duration: "3m", target: 100 },
    { duration: "2m", target: 100 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{name:cards_page}": ["p(95)<1500"],
    "http_req_duration{name:card_detail_page}": ["p(95)<1500"],
    "http_req_duration{name:collections_page}": ["p(95)<1500"],
    "http_req_duration{name:decks_page}": ["p(95)<1500"],
    "http_req_duration{name:get_session}": ["p(95)<500"],
  },
};

export function setup() {
  probeSession();
  return fetchSlugs();
}

export { authedJourney as default } from "./lib/session.js";
