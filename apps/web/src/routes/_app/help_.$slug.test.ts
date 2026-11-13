import { describe, expect, it } from "vitest";

import { headCanonical, headMeta, headTitle, runRouteHead } from "@/test/route-head";

import { Route } from "./help_.$slug";

const PARAMS = { slug: "cards-printings-copies" };

describe("/help/$slug head", () => {
  it("indexes an article the visitor can read", () => {
    const head = runRouteHead(Route, PARAMS, { served: true });

    expect(headMeta(head, "robots")).toBeUndefined();
    expect(headCanonical(head)).toBe("http://localhost:5173/help/cards-printings-copies");
  });

  it("keeps the not-found page of a hidden or unknown article out of search", () => {
    const head = runRouteHead(Route, PARAMS, undefined);

    expect(headTitle(head)).toBe("Help - OpenRift");
    expect(headMeta(head, "robots")).toBe("noindex, nofollow");
    expect(headCanonical(head)).toBeUndefined();
  });
});
