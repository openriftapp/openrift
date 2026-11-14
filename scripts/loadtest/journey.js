// Against a Cloudflare-fronted host this mostly exercises the edge; use
// cache-miss.js to stress the origin.

import { fetchSlugs } from "./lib/setup.js";

export const options = {
  stages: [
    { duration: "1m", target: 50 },
    { duration: "2m", target: 200 },
    { duration: "5m", target: 200 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{name:cards_page}": ["p(95)<1500"],
    "http_req_duration{name:card_detail}": ["p(95)<1500"],
    "http_req_duration{name:catalog_api}": ["p(95)<2000"],
  },
};

export function setup() {
  return fetchSlugs();
}

export { anonJourney as default } from "./lib/anon-journey.js";
