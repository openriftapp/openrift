import { describe, expect, it } from "vitest";

import { legendDisplayName } from "./card-name.js";
import { metaLegendSlug, metaPlayerKey } from "./meta-keys.js";

describe("metaPlayerKey", () => {
  it("keeps a uvsgames identity as it is", () => {
    expect(metaPlayerKey("u347713")).toBe("u347713");
  });

  it("folds the per-event suffix off a playloltcg identity", () => {
    expect(metaPlayerKey("pn乌冬#1")).toBe("pn乌冬");
    expect(metaPlayerKey("pnARBD-Jay#12")).toBe("pnARBD-Jay");
  });

  it("leaves a hash inside the name alone", () => {
    expect(metaPlayerKey("pnC#Dev#1")).toBe("pnC#Dev");
  });

  it("returns null for a row with no identity", () => {
    expect(metaPlayerKey(null)).toBeNull();
    expect(metaPlayerKey("")).toBeNull();
  });
});

describe("metaLegendSlug", () => {
  it("leads with the champion and keeps the card slug behind it", () => {
    expect(metaLegendSlug("Kennen, Heart of the Tempest", "heart-of-the-tempest")).toBe(
      "kennen-heart-of-the-tempest",
    );
  });

  it("keys an untagged legend on its card slug alone", () => {
    expect(metaLegendSlug("Nameless Legend", "nameless-legend")).toBe("nameless-legend");
  });

  it("separates two legends of the same champion", () => {
    expect(metaLegendSlug("Master Yi, Wuju Master", "wuju-master")).toBe("master-yi-wuju-master");
    expect(metaLegendSlug("Master Yi, Wuju Bladesman", "wuju-bladesman-starter")).toBe(
      "master-yi-wuju-bladesman-starter",
    );
  });

  it("slugifies a champion whose name carries punctuation or spaces", () => {
    expect(metaLegendSlug("Kai’Sa, Survivor", "survivor")).toBe("kai-sa-survivor");
    expect(metaLegendSlug("Lee Sin, Blind Monk", "blind-monk")).toBe("lee-sin-blind-monk");
  });

  it("round-trips the name legendDisplayName composes", () => {
    const name = legendDisplayName({
      name: "Dark Child, Starter",
      types: ["legend"],
      tags: ["Annie"],
    });
    expect(metaLegendSlug(name, "dark-child-starter")).toBe("annie-dark-child-starter");
  });
});
