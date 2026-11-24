import { describe, expect, it } from "vitest";

import { pickTagTranslations } from "./tag-translation-discovery.js";

const pair = (label: string, tag: string, count: number) => ({ language: "SC", label, tag, count });

describe("pickTagTranslations", () => {
  it("takes the tag a label is paired with on several cards", () => {
    expect(pickTagTranslations([pair("海盗", "Pirate", 12)]).discovered).toEqual([
      { language: "SC", label: "海盗", tag: "Pirate" },
    ]);
  });

  it("ignores a pairing seen on one card only", () => {
    const result = pickTagTranslations([pair("海盗", "Pirate", 1)]);
    expect(result).toEqual({ discovered: [], conflicts: [] });
  });

  it("lets a clear majority win over a stray pairing from reordered tags", () => {
    const result = pickTagTranslations([
      pair("德玛西亚", "Jarvan IV", 2),
      pair("德玛西亚", "Demacia", 54),
    ]);
    expect(result.discovered).toEqual([{ language: "SC", label: "德玛西亚", tag: "Demacia" }]);
    expect(result.conflicts).toEqual([]);
  });

  it("reports a close call as a conflict and maps nothing", () => {
    const result = pickTagTranslations([pair("某", "Shurima", 25), pair("某", "K’Sante", 23)]);
    expect(result.discovered).toEqual([]);
    expect(result.conflicts).toEqual([
      { language: "SC", label: "某", tags: ["Shurima", "K’Sante"] },
    ]);
  });

  it("keeps the same label apart per language", () => {
    const result = pickTagTranslations([
      { language: "SC", label: "龙", tag: "Dragon", count: 5 },
      { language: "TC", label: "龙", tag: "Dragon", count: 4 },
    ]);
    expect(result.discovered).toHaveLength(2);
  });
});
