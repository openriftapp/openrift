import { describe, expect, it } from "vitest";

import { makeAdminPrinting } from "@/test/factories";

import {
  buildFaceRows,
  faceIdsOfPrinting,
  pairNamesByPrinting,
  printingPairName,
} from "./face-rows";

const empowered = { faceId: "fe", cardName: "Empowered", cardSlug: "e", publicCode: "VEN-T01" };

describe("printingPairName", () => {
  it("puts face 1's card first when this card is face 2", () => {
    const printing = makeAdminPrinting({ side: 2, otherFace: empowered });

    expect(printingPairName(printing, "Tentacle")).toBe("Empowered // Tentacle");
  });

  it("puts this card first when it is face 1", () => {
    const printing = makeAdminPrinting({ side: 1, otherFace: empowered });

    expect(printingPairName(printing, "Tentacle")).toBe("Tentacle // Empowered");
  });

  it("names a single-faced printing after the card alone", () => {
    expect(printingPairName(makeAdminPrinting(), "Tentacle")).toBe("Tentacle");
  });
});

describe("pairNamesByPrinting", () => {
  it("names only the double-faced printings", () => {
    const pair = makeAdminPrinting({ id: "p1", side: 2, otherFace: empowered });
    const single = makeAdminPrinting({ id: "p2" });

    expect(pairNamesByPrinting([pair, single], "Tentacle")).toEqual(
      new Map([["p1", "Empowered // Tentacle"]]),
    );
  });
});

describe("buildFaceRows", () => {
  it("gives a single-faced printing its own row", () => {
    const printing = makeAdminPrinting({ id: "p1", faceId: "f1", language: "EN" });

    expect(buildFaceRows([printing])).toEqual([
      { faceId: "f1", language: "EN", printing, printings: [printing] },
    ]);
  });

  it("merges the printings that share a face into one row", () => {
    const withEmpowered = makeAdminPrinting({ id: "p1", faceId: "tentacle", side: 2 });
    const withShadowClone = makeAdminPrinting({ id: "p2", faceId: "tentacle", side: 2 });
    const promo = makeAdminPrinting({ id: "p3", faceId: "tentacle-promo", side: 2 });

    const rows = buildFaceRows([withEmpowered, promo, withShadowClone]);

    expect(rows.map((row) => row.faceId)).toEqual(["tentacle", "tentacle-promo"]);
    expect(rows[0]?.printings).toEqual([withEmpowered, withShadowClone]);
    expect(rows[0]?.printing).toBe(withEmpowered);
  });

  it("returns no rows for no printings", () => {
    expect(buildFaceRows([])).toEqual([]);
  });
});

describe("faceIdsOfPrinting", () => {
  it("finds the face a printing shows", () => {
    const rows = [
      makeAdminPrinting({ id: "p1", faceId: "f1" }),
      makeAdminPrinting({ id: "p2", faceId: "f2" }),
    ];

    expect(faceIdsOfPrinting(rows, "p2")).toEqual(["f2"]);
  });

  it("finds both faces when the card is on both faces of the printing", () => {
    const rows = [
      makeAdminPrinting({ id: "p1", faceId: "buff-a", side: 1 }),
      makeAdminPrinting({ id: "p1", faceId: "buff-b", side: 2 }),
    ];

    expect(faceIdsOfPrinting(rows, "p1")).toEqual(["buff-a", "buff-b"]);
  });

  it("finds nothing for a printing of another card", () => {
    expect(faceIdsOfPrinting([makeAdminPrinting({ id: "p1" })], "p9")).toEqual([]);
  });
});
