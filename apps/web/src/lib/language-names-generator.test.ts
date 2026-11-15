import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// oxlint-disable-next-line eslint/no-restricted-imports -- the generator lives in scripts/, outside the @/ alias
import { cldrLanguageName } from "../../../../scripts/cldr-language-name";

const KO = path.resolve(import.meta.dirname, "../../../../scripts/data/cldr-48.2.0/ko");

function koNames(file: string): Record<string, unknown> {
  const parsed = JSON.parse(readFileSync(path.join(KO, file), "utf-8")) as {
    main: { ko: { localeDisplayNames: Record<string, unknown> } };
  };
  return parsed.main.ko.localeDisplayNames;
}

const ko = {
  languages: koNames("languages.json").languages as Record<string, string>,
  scripts: koNames("scripts.json").scripts as Record<string, string>,
  localePattern: (
    koNames("localeDisplayNames.json").localeDisplayPattern as { localePattern: string }
  ).localePattern,
};

describe("cldrLanguageName", () => {
  it("composes the Korean names of the two Chinese scripts from language, script and pattern", () => {
    expect(ko.languages["zh-Hans"]).toBeUndefined();
    expect(cldrLanguageName(ko, "zh-Hans")).toBe("중국어(간체)");
    expect(cldrLanguageName(ko, "zh-Hant")).toBe("중국어(번체)");
  });

  it("prefers a name CLDR lists for the whole tag", () => {
    expect(
      cldrLanguageName(
        {
          languages: { zh: "Chinese", "zh-Hans": "Simplified Chinese" },
          scripts: { Hans: "Simplified" },
          localePattern: "{0} ({1})",
        },
        "zh-Hans",
      ),
    ).toBe("Simplified Chinese");
  });

  it("returns undefined when neither the tag nor its parts are named", () => {
    expect(cldrLanguageName({ languages: {} }, "zh-Hans")).toBeUndefined();
    expect(cldrLanguageName(ko, "xx-Zzzz")).toBeUndefined();
  });
});
