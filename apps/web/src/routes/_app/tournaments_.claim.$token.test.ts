import { describe, expect, it } from "vitest";

import { Route } from "./tournaments_.claim.$token";

type Head = (ctx: { loaderData?: { claimsDeck: boolean } }) => { meta?: { title?: string }[] };
const head = Route.options.head as unknown as Head;

function title(loaderData?: { claimsDeck: boolean }): string | undefined {
  return head({ loaderData }).meta?.find((entry) => entry.title !== undefined)?.title;
}

describe("claim page document title", () => {
  it("names the deck on an event with decklists", () => {
    expect(title({ claimsDeck: true })).toContain("Claim your deck");
  });

  it("names the spot on an event without decklists", () => {
    expect(title({ claimsDeck: false })).toContain("Claim your spot");
  });

  it("names the spot when the landing did not load", () => {
    expect(title()).toContain("Claim your spot");
  });
});
