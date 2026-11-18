import { describe, expect, it } from "vitest";

import { cardErrataRepo } from "./card-errata.js";

describe("cardErrataRepo", () => {
  it("getByCardIds short-circuits on an empty id list", async () => {
    const throwingDb = new Proxy(
      {},
      {
        get() {
          throw new Error("db must not be touched for an empty id list");
        },
      },
    ) as never;
    expect(await cardErrataRepo(throwingDb).getByCardIds([])).toEqual([]);
  });
});
