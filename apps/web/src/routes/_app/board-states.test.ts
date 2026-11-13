import { describe, expect, it } from "vitest";

import { headCanonical, headMeta, runRouteHead } from "@/test/route-head";

import { Route } from "./board-states";

describe("/board-states head", () => {
  it("names the canonical page while board states are switched on", () => {
    expect(headCanonical(runRouteHead(Route, {}, { served: true }))).toBe(
      "http://localhost:5173/board-states",
    );
  });

  it("drops the canonical link from the not-found page while board states are switched off", () => {
    const head = runRouteHead(Route, {}, undefined);

    expect(headMeta(head, "robots")).toBe("noindex, nofollow");
    expect(headCanonical(head)).toBeUndefined();
  });
});
