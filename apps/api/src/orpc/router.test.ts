import { describe, expect, it } from "vitest";

import { ADMIN_API_PREFIX } from "../lib/admin-api-prefix.js";
import { apiRouters } from "./router.js";

function procedurePaths(node: unknown): string[] {
  if (!node || typeof node !== "object") {
    return [];
  }
  const path = (node as { "~orpc"?: { route?: { path?: string } } })["~orpc"]?.route?.path;
  if (path !== undefined) {
    return [path];
  }
  return Object.values(node).flatMap((child) => procedurePaths(child));
}

const entries = Object.entries(apiRouters).map(([key, router]) => ({
  key,
  paths: procedurePaths(router),
}));

describe("apiRouter admin gate", () => {
  it("finds the procedures of every router", () => {
    for (const { key, paths } of entries) {
      expect(paths, key).not.toHaveLength(0);
    }
  });

  it("mounts every admin router's procedures under the requireAdmin prefix", () => {
    const outside = entries
      .filter(({ key }) => key.startsWith("admin"))
      .flatMap(({ key, paths }) =>
        paths
          .filter((path) => !path.startsWith(`${ADMIN_API_PREFIX}/`))
          .map((path) => `${key} ${path}`),
      );
    expect(outside).toEqual([]);
  });

  it("puts no admin-looking path outside the gated prefix", () => {
    const stray = entries
      .flatMap(({ paths }) => paths)
      .filter((path) => path.startsWith("/api/admin") && !path.startsWith(`${ADMIN_API_PREFIX}/`));
    expect(stray).toEqual([]);
  });
});
