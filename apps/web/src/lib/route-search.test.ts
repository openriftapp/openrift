import { describe, expect, it } from "vitest";

import { authSearchSchema, roundSearchSchema } from "./route-search";

describe("authSearchSchema", () => {
  it("keeps a same-origin redirect and the email", () => {
    expect(
      authSearchSchema({ redirect: "/decks?tab=mine", email: "summoner@example.com" }),
    ).toEqual({ redirect: "/decks?tab=mine", email: "summoner@example.com" });
  });

  it("drops an off-site or protocol-relative redirect", () => {
    expect(authSearchSchema({ redirect: "https://evil.example" }).redirect).toBeUndefined();
    expect(authSearchSchema({ redirect: "//evil.example" }).redirect).toBeUndefined();
  });

  it("drops values that are not strings", () => {
    expect(authSearchSchema({ redirect: 42, email: ["a@example.com"] })).toEqual({
      redirect: undefined,
      email: undefined,
    });
  });

  it("treats an empty email as absent", () => {
    expect(authSearchSchema({ email: "" }).email).toBeUndefined();
  });

  it("returns both keys when nothing is given", () => {
    expect(authSearchSchema({})).toEqual({ redirect: undefined, email: undefined });
  });
});

describe("roundSearchSchema", () => {
  it("parses a positive integer round", () => {
    expect(roundSearchSchema({ round: "3" })).toEqual({ round: 3 });
    expect(roundSearchSchema({ round: 2 })).toEqual({ round: 2 });
  });

  it.each([0, -1, 1.5, "abc", "", undefined, null])("drops %o", (round) => {
    expect(roundSearchSchema({ round })).toEqual({});
  });
});
