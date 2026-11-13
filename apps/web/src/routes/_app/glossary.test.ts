import { describe, expect, it } from "vitest";

import { headCanonical, headMeta, runRouteHead } from "@/test/route-head";

import { Route } from "./glossary";

describe("/glossary head", () => {
  it("indexes the glossary while it is switched on", () => {
    const head = runRouteHead(Route, {}, { served: true });

    expect(headMeta(head, "robots")).toBeUndefined();
    expect(headCanonical(head)).toBe("http://localhost:5173/glossary");
  });

  it("keeps the not-found page out of search while the glossary is switched off", () => {
    const head = runRouteHead(Route, {}, undefined);

    expect(headMeta(head, "robots")).toBe("noindex, nofollow");
    expect(headCanonical(head)).toBeUndefined();
  });
});
