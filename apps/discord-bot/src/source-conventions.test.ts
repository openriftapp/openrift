import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const SRC = import.meta.dirname;

function filesMatching(pattern: RegExp): string[] {
  return readdirSync(SRC, { recursive: true, encoding: "utf-8" })
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
    .filter((file) => pattern.test(readFileSync(path.join(SRC, file), "utf-8")));
}

describe("source conventions", () => {
  it("names a card in a reply through legendDisplayName", () => {
    expect(filesMatching(/\$\{[\w?.]*\bcard\??\.name\}|\bcard\??\.name\.localeCompare\(/u)).toEqual(
      [],
    );
  });

  it("builds card lookups only through the shared lookup builders", () => {
    expect(
      filesMatching(
        /import \{[^}]*\b(?:buildCardIndex|cardSearchAltNames)\b[^}]*\} from "@openrift\/shared\/card-(?:search|name)"|import \* as \w+ from "@openrift\/shared\/card-(?:search|name)"|export \{[^}]*\bbuildCardIndex\b/u,
      ),
    ).toEqual([]);
  });

  it("matches typed text only through the shared folding matchers", () => {
    expect(
      filesMatching(
        /\.to(?:Locale)?LowerCase\(\)\.(?:includes|startsWith)\(|foldForSearch\([^)]*\)\.includes\(|(?:content|plain)\w*: [^,\n]*\.toLowerCase\(\)/u,
      ),
    ).toEqual([]);
  });

  it("builds card page links only through cardUrl", () => {
    expect(filesMatching(/`[^`]*\/cards\/\$\{|\$\{cardPath\(/u)).toEqual([]);
  });
});
