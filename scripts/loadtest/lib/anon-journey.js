import { check, sleep } from "k6";
import http from "k6/http";

import { API_BASE, BASE_URL } from "./config.js";
import { pick } from "./setup.js";

export function anonJourney(data) {
  http.get(`${BASE_URL}/`, { tags: { name: "home" } });
  sleep(Math.random() * 2 + 1);

  http.get(`${BASE_URL}/cards`, { tags: { name: "cards_page" } });
  http.get(`${API_BASE}/catalog`, { tags: { name: "catalog_api" } });
  sleep(Math.random() * 3 + 2);

  const slug = pick(data.cardSlugs);
  const detail = http.get(`${API_BASE}/cards/${slug}`, { tags: { name: "card_detail" } });
  check(detail, { "card detail ok": (r) => r.status === 200 });
  sleep(Math.random() * 4 + 2);

  if (Math.random() < 0.4) {
    const setSlug = pick(data.setSlugs);
    http.get(`${API_BASE}/sets/${setSlug}`, { tags: { name: "set_detail" } });
    sleep(Math.random() * 2 + 1);
  }
}
