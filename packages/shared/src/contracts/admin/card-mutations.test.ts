import { describe, expect, it } from "vitest";

import { REQUIRED_CARD_FIELD_KEYS, REQUIRED_PRINTING_FIELD_KEYS } from "./card-mutations.js";

describe("required field keys", () => {
  it("lists every accepted printing field the server rejects blank", () => {
    expect([...REQUIRED_PRINTING_FIELD_KEYS].toSorted()).toEqual([
      "artVariant",
      "artist",
      "finish",
      "isOvernumbered",
      "isSigned",
      "language",
      "publicCode",
      "rarity",
      "setId",
      "shortCode",
      "size",
    ]);
  });

  it("lists every accepted card field the server rejects blank", () => {
    expect([...REQUIRED_CARD_FIELD_KEYS].toSorted()).toEqual(["domains", "name", "types"]);
  });
});
