// oxlint-disable no-nodejs-modules -- this test introspects the source tree, so it must read files from disk
import { readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

import * as barrel from "./index.js";

const contractFiles = readdirSync(import.meta.dirname, {
  recursive: true,
  encoding: "utf-8",
}).filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts") && file !== "index.ts");

describe("contracts barrel", () => {
  it("re-exports every contract so the OpenAPI document includes it", async () => {
    const missing: string[] = [];
    for (const file of contractFiles) {
      const mod: Record<string, unknown> = await import(`./${file}`);
      for (const key of Object.keys(mod)) {
        if (key.endsWith("Contract") && !(key in barrel)) {
          missing.push(`${file}: ${key}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
