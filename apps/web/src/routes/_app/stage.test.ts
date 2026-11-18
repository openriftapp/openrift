import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { Route } from "./stage";

const validateSearch = Route.options.validateSearch as unknown as {
  parse: (search: Record<string, unknown>) => Record<string, unknown>;
};

describe("/stage filter search", () => {
  it("validates the shared filter search params", () => {
    expect(validateSearch.parse({ q: "ekko", sets: ["ogn"], sort: "name" })).toMatchObject({
      q: "ekko",
      sets: ["ogn"],
      sort: "name",
    });
  });

  it("drops unknown search params", () => {
    expect(validateSearch.parse({ nonsense: "x" })).not.toHaveProperty("nonsense");
  });

  it("wraps the builder in a FilterSearchProvider", () => {
    const source = readFileSync(
      path.resolve(import.meta.dirname, "../../features/stage/components/stage-page.tsx"),
      "utf-8",
    );
    expect(source).toMatch(/<FilterSearchProvider value=\{search\}>/u);
  });
});

describe("/stage builder search writes", () => {
  const source = readFileSync(
    path.resolve(import.meta.dirname, "../../features/stage/components/stage-page.tsx"),
    "utf-8",
  );

  it("starts presenting on the show through startPresentingSearch", () => {
    expect(source).toMatch(
      /to: "\/stage\/show", search: \(prev\) => startPresentingSearch\(prev, ids\)/u,
    );
  });

  it("mirrors queue edits into the URL through queueDraftSearch", () => {
    expect(source).toMatch(/queueDraftSearch\(prev, state\.ids\)/u);
  });
});

describe("/stage chrome", () => {
  it("keeps the app frame around the builder", () => {
    expect(Route.options.staticData?.chrome).toBeUndefined();
  });
});
