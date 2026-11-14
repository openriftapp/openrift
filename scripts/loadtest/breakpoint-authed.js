// Ramps VUs with a real session cookie so Cloudflare bypasses its edge
// cache and every request hits origin SSR. Aborts once the SLO is breached.
// Get LOADTEST_SESSION_COOKIE by signing in on the target host and copying
// __Secure-better-auth.session_token; pass it (and BASE_URL) via env.

import { probeSession } from "./lib/session.js";
import { fetchSlugs } from "./lib/setup.js";

const MAX_VUS = Number(__ENV.MAX_VUS ?? 500);
const RAMP_DURATION = __ENV.RAMP_DURATION ?? "20m";

export const options = {
  scenarios: {
    breakpoint: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: RAMP_DURATION, target: MAX_VUS },
        { duration: "1m", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    http_req_failed: [{ threshold: "rate<0.05", abortOnFail: true, delayAbortEval: "1m" }],
    "http_req_duration{name:cards_page}": [
      { threshold: "p(95)<2500", abortOnFail: true, delayAbortEval: "1m" },
    ],
    "http_req_duration{name:card_detail_page}": [
      { threshold: "p(95)<2500", abortOnFail: true, delayAbortEval: "1m" },
    ],
    "http_req_duration{name:collections_page}": [
      { threshold: "p(95)<2500", abortOnFail: true, delayAbortEval: "1m" },
    ],
    "http_req_duration{name:decks_page}": [
      { threshold: "p(95)<2500", abortOnFail: true, delayAbortEval: "1m" },
    ],
    "http_req_duration{name:get_session}": [
      { threshold: "p(95)<1000", abortOnFail: true, delayAbortEval: "1m" },
    ],
  },
};

export function setup() {
  probeSession();
  return fetchSlugs();
}

export { authedJourney as default } from "./lib/session.js";
