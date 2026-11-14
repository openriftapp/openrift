import { labelMap } from "@openrift/shared/enum-label";
import { describe, expect, it } from "vitest";

import { importSpecialties } from "./import-specialties";

const FINISHES = labelMap([{ slug: "foil", label: "Foil" }]);
const ART_VARIANTS = labelMap([{ slug: "altart", label: "Alt Art" }]);

describe("importSpecialties", () => {
  it("returns null for a plain printing", () => {
    expect(
      importSpecialties({ finish: "normal", artVariant: "normal" }, FINISHES, ART_VARIANTS),
    ).toBe(null);
  });

  it("joins finish, alt art and overnumbered in that order", () => {
    expect(
      importSpecialties(
        { finish: "foil", artVariant: "altart", isOvernumbered: true },
        FINISHES,
        ART_VARIANTS,
      ),
    ).toBe("Foil · Alt Art · Overnumbered");
  });
});
