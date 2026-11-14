// Ramps VUs, aborting once the SLO is breached. Against a Cloudflare-fronted
// host this mostly measures edge capacity; use breakpoint-authed.js for the
// origin SSR ceiling.

import { fetchSlugs } from "./lib/setup.js";

const MAX_VUS = Number(__ENV.MAX_VUS ?? 1000);
const RAMP_DURATION = __ENV.RAMP_DURATION ?? "30m";

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
    "http_req_duration{name:card_detail}": [
      { threshold: "p(95)<2500", abortOnFail: true, delayAbortEval: "1m" },
    ],
    "http_req_duration{name:catalog_api}": [
      { threshold: "p(95)<3000", abortOnFail: true, delayAbortEval: "1m" },
    ],
  },
};

export function setup() {
  return fetchSlugs();
}

export { anonJourney as default } from "./lib/anon-journey.js";
