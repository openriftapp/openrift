import { afterEach, describe, expect, it, vi } from "vitest";

import { initQueryOptions } from "@/lib/init-queries";
import { getLocale, overwriteGetLocale } from "@/paraglide/runtime.js";
import { headCanonical, headMeta, headTitle, runRouteHead } from "@/test/route-head";

import { Route } from "./help_.$slug";

vi.mock("@/paraglide/messages.js", async () => ({
  m: await import("@/test/paraglide-all.js"),
}));

const PARAMS = { slug: "cards-printings-copies" };
const baseGetLocale = getLocale;

describe("/help/$slug head", () => {
  afterEach(() => {
    overwriteGetLocale(baseGetLocale);
  });

  it("titles the page in English for every viewer", () => {
    overwriteGetLocale(() => "de");
    const head = runRouteHead(Route, PARAMS, { served: true });

    expect(headTitle(head)).toBe("Cards, Printings & Copies - Help - OpenRift");
  });

  it("indexes an article the visitor can read", () => {
    const head = runRouteHead(Route, PARAMS, { served: true });

    expect(headTitle(head)).toBe("Cards, Printings & Copies - Help - OpenRift");
    expect(headMeta(head, "robots")).toBeUndefined();
    expect(headCanonical(head)).toBe("http://localhost:5173/help/cards-printings-copies");
  });

  it("keeps the not-found page of a hidden or unknown article out of search", () => {
    const head = runRouteHead(Route, PARAMS, undefined);

    expect(headTitle(head)).toBe("Help - OpenRift");
    expect(headMeta(head, "robots")).toBe("noindex, nofollow");
    expect(headCanonical(head)).toBeUndefined();
  });

  it("loads the shared init data the article reads on render", async () => {
    const query = vi.fn(() => Promise.resolve({}));
    const loader = Route.options.loader as (ctx: unknown) => Promise<unknown>;

    await loader({ context: { queryClient: { query } }, params: PARAMS });

    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: initQueryOptions.queryKey, staleTime: "static" }),
    );
  });
});
