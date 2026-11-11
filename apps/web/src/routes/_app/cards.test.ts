import type { AnyRedirect } from "@tanstack/react-router";
import { isRedirect } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { cardsSearchSchema } from "@/features/cards/lib/cards-search-schema";

import { Route } from "./cards";

type Hook = (ctx: Record<string, unknown>) => unknown;

function thrownBy(searchStr: string): AnyRedirect {
  const raw = Object.fromEntries(new URLSearchParams(searchStr));
  const search = { ...raw, ...cardsSearchSchema.parse(raw) };
  try {
    (Route.options.beforeLoad as unknown as Hook)({ search, location: { searchStr } });
  } catch (error) {
    expect(isRedirect(error)).toBe(true);
    return error as AnyRedirect;
  }
  throw new Error("nothing was thrown");
}

describe("/cards search cleanup redirect", () => {
  it("answers a lone redirect param with a permanent redirect to /cards", () => {
    const thrown = thrownBy("?redirect=%2Fmeta%2Fsummoner-skirmish%2Fsubmit");

    expect(thrown.options).toMatchObject({ to: "/cards", search: {}, statusCode: 301 });
    expect(thrown.options.search).toEqual({});
  });

  it("keeps q and drops redirect with a temporary redirect", () => {
    const thrown = thrownBy("?redirect=x&q=jinx");

    expect(thrown.options).toMatchObject({ search: { q: "jinx" }, statusCode: 307 });
    expect(thrown.options.search).toEqual({ q: "jinx" });
  });

  it("keeps an invalid filter value cleanup temporary", () => {
    const thrown = thrownBy("?sort=garbage");

    expect(thrown.options).toMatchObject({ search: {}, statusCode: 307 });
    expect(thrown.options.search).toEqual({});
  });

  it("does not redirect a clean URL", () => {
    expect(() =>
      (Route.options.beforeLoad as unknown as Hook)({
        search: cardsSearchSchema.parse({ q: "jinx" }),
        location: { searchStr: "?q=jinx" },
      }),
    ).not.toThrow();
  });
});
