import { describe, expect, it } from "vitest";

import {
  bootAdminModules,
  classicZodModules,
  findBootChunks,
  findForbiddenBootChunks,
} from "./boot-chunk-guard";

function graph(edges: Record<string, { name: string; imports: string[] }>) {
  return new Map(Object.entries(edges));
}

describe("findForbiddenBootChunks", () => {
  it("reports the static import path to a forbidden chunk", () => {
    const chunks = graph({
      "index.js": { name: "index", imports: ["page-top-bar.js", "react-dom.js"] },
      "page-top-bar.js": { name: "page-top-bar", imports: ["tooltip.js"] },
      "tooltip.js": { name: "tooltip", imports: ["base-ui-abc.js"] },
      "base-ui-abc.js": { name: "base-ui", imports: [] },
      "react-dom.js": { name: "react-dom", imports: [] },
    });

    expect(findForbiddenBootChunks("index.js", chunks, ["base-ui"])).toEqual(
      new Map([
        ["base-ui-abc.js", ["index.js", "page-top-bar.js", "tooltip.js", "base-ui-abc.js"]],
      ]),
    );
  });

  it("passes when the forbidden chunk is only reachable from chunks the entry does not import", () => {
    const chunks = graph({
      "index.js": { name: "index", imports: ["base-ui-shell.js"] },
      "base-ui-shell.js": { name: "base-ui-shell", imports: [] },
      "admin.lazy.js": { name: "admin.lazy", imports: ["base-ui-abc.js"] },
      "base-ui-abc.js": { name: "base-ui", imports: [] },
    });

    expect(findForbiddenBootChunks("index.js", chunks, ["base-ui"]).size).toBe(0);
  });

  it("terminates on import cycles", () => {
    const chunks = graph({
      "index.js": { name: "index", imports: ["a.js"] },
      "a.js": { name: "a", imports: ["index.js", "base-ui-abc.js"] },
      "base-ui-abc.js": { name: "base-ui", imports: ["a.js"] },
    });

    expect([...findForbiddenBootChunks("index.js", chunks, ["base-ui"]).keys()]).toEqual([
      "base-ui-abc.js",
    ]);
  });
});

const ZOD = "/repo/node_modules/.bun/zod@4.6.7/node_modules/zod/v4";

describe("classicZodModules", () => {
  it("reports rendered classic and locale modules", () => {
    expect(
      classicZodModules({
        name: "schemas",
        imports: [],
        modules: {
          [`${ZOD}/classic/schemas.js`]: { renderedLength: 120 },
          [`${ZOD}/locales/en.js`]: { renderedLength: 40 },
          [`${ZOD}/core/schemas.js`]: { renderedLength: 900 },
          [`${ZOD}/mini/schemas.js`]: { renderedLength: 300 },
        },
      }),
    ).toEqual([`${ZOD}/classic/schemas.js`, `${ZOD}/locales/en.js`]);
  });

  it("ignores classic modules that tree-shaking emptied", () => {
    expect(
      classicZodModules({
        name: "schemas",
        imports: [],
        modules: { [`${ZOD}/classic/schemas.js`]: { renderedLength: 0 } },
      }),
    ).toEqual([]);
  });

  it("reports zod v3", () => {
    const id = "/repo/node_modules/.bun/zod@3.25.76/node_modules/zod/v3/types.js";
    expect(
      classicZodModules({ name: "x", imports: [], modules: { [id]: { renderedLength: 1 } } }),
    ).toEqual([id]);
  });
});

describe("findBootChunks", () => {
  it("finds a classic zod chunk the entry reaches statically", () => {
    const chunks = new Map([
      ["index.js", { name: "index", imports: ["schemas.js"] }],
      [
        "schemas.js",
        {
          name: "schemas",
          imports: [],
          modules: { [`${ZOD}/classic/schemas.js`]: { renderedLength: 10 } },
        },
      ],
    ]);

    expect(
      findBootChunks("index.js", chunks, (chunk) => classicZodModules(chunk).length > 0),
    ).toEqual(new Map([["schemas.js", ["index.js", "schemas.js"]]]));
  });
});

const SRC = "/repo/apps/web/src";

describe("bootAdminModules", () => {
  it("reports rendered admin and workspace modules outside the allowlist", () => {
    expect(
      bootAdminModules({
        name: "index",
        imports: [],
        modules: {
          [`${SRC}/features/admin/lib/sets-queries.ts`]: { renderedLength: 80 },
          [`${SRC}/features/catalog-workspace/lib/draft.ts?tsr-split=loader`]: {
            renderedLength: 20,
          },
          [`${SRC}/features/admin/lib/admin-query-keys.ts`]: { renderedLength: 400 },
          [`${SRC}/features/cards/lib/sets-queries.ts`]: { renderedLength: 90 },
        },
      }),
    ).toEqual(["features/admin/lib/sets-queries.ts", "features/catalog-workspace/lib/draft.ts"]);
  });

  it("ignores admin modules that tree-shaking emptied", () => {
    expect(
      bootAdminModules({
        name: "index",
        imports: [],
        modules: { [`${SRC}/features/admin/lib/card-attention.ts`]: { renderedLength: 0 } },
      }),
    ).toEqual([]);
  });

  it("accepts a custom allowlist", () => {
    const id = `${SRC}/features/admin/lib/review-queue.ts`;
    expect(
      bootAdminModules(
        { name: "index", imports: [], modules: { [id]: { renderedLength: 5 } } },
        { "features/admin/lib/review-queue.ts": "test" },
      ),
    ).toEqual([]);
  });
});
