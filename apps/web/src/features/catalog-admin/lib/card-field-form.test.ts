import { beforeEach, describe, expect, it } from "vitest";

import { makeAdminCard, resetIdCounter } from "@/test/factories";

import {
  applyFieldValue,
  cardFormChanges,
  cardFormFromCard,
  cardFormState,
  formatListInput,
  parseCardForm,
  parseListInput,
} from "./card-field-form";

beforeEach(() => {
  resetIdCounter();
});

describe("cardFormFromCard", () => {
  it("renders absent numbers as empty text", () => {
    const form = cardFormFromCard(
      makeAdminCard({ might: 3, mightBonus: null, maxCopiesOverride: null, comment: null }),
    );
    expect(form.might).toBe("3");
    expect(form.mightBonus).toBe("");
    expect(form.maxCopiesOverride).toBe("");
    expect(form.comment).toBe("");
  });
});

describe("parseListInput", () => {
  it("splits, trims and drops empty entries", () => {
    expect(parseListInput(" calm , fury ,, ")).toEqual(["calm", "fury"]);
  });

  it("round-trips through formatListInput", () => {
    expect(parseListInput(formatListInput(["calm", "fury"]))).toEqual(["calm", "fury"]);
  });
});

describe("parseCardForm", () => {
  it("flags a number that is not whole", () => {
    const form = { ...cardFormFromCard(makeAdminCard()), might: "3.5" };
    const { issues, values } = parseCardForm(form);
    expect(issues).toEqual([{ field: "might", message: "Might must be a whole number." }]);
    expect(values.some((entry) => entry.field === "might")).toBe(false);
  });

  it("flags an empty name and empty domains", () => {
    const form = { ...cardFormFromCard(makeAdminCard()), name: "  ", domains: [] };
    const { issues } = parseCardForm(form);
    expect(issues.map((issue) => issue.field)).toEqual(["name", "domains"]);
  });

  it("turns a blank comment into null", () => {
    const form = { ...cardFormFromCard(makeAdminCard()), comment: "   " };
    const { values } = parseCardForm(form);
    expect(values.find((entry) => entry.field === "comment")?.value).toBeNull();
  });
});

describe("cardFormChanges", () => {
  it("returns only the fields that differ from the card", () => {
    const card = makeAdminCard({ name: "Lux, Lady of Luminosity", energy: 2, domains: ["calm"] });
    const form = { ...cardFormFromCard(card), energy: "4", domains: ["calm", "fury"] };
    expect(cardFormChanges(form, card)).toEqual([
      { field: "domains", value: ["calm", "fury"] },
      { field: "energy", value: 4 },
    ]);
  });

  it("treats a reordered list as a change", () => {
    const card = makeAdminCard({ domains: ["calm", "fury"] });
    const form = { ...cardFormFromCard(card), domains: ["fury", "calm"] };
    expect(cardFormChanges(form, card)).toEqual([{ field: "domains", value: ["fury", "calm"] }]);
  });

  it("returns nothing for an untouched form", () => {
    const card = makeAdminCard();
    expect(cardFormChanges(cardFormFromCard(card), card)).toEqual([]);
  });

  it("skips a field that failed validation", () => {
    const card = makeAdminCard({ power: 1 });
    const form = { ...cardFormFromCard(card), power: "one" };
    expect(cardFormChanges(form, card)).toEqual([]);
  });
});

describe("cardFormState", () => {
  it("stays silent about a field the card arrived without", () => {
    const card = makeAdminCard({ types: [], domains: [] });
    const form = { ...cardFormFromCard(card), comment: "Checked against the printed card" };
    const state = cardFormState(form, card);
    expect(state.issues).toEqual([]);
    expect(state.changes).toEqual([
      { field: "comment", value: "Checked against the printed card" },
    ]);
  });

  it("reports an issue on a field the reviewer edited", () => {
    const card = makeAdminCard({ domains: ["calm"] });
    const form = { ...cardFormFromCard(card), domains: [] };
    expect(cardFormState(form, card).issues.map((issue) => issue.field)).toEqual(["domains"]);
  });
});

describe("applyFieldValue", () => {
  it("copies a list value as strings", () => {
    const form = cardFormFromCard(makeAdminCard());
    expect(applyFieldValue(form, "types", ["unit", "spell"]).types).toEqual(["unit", "spell"]);
  });

  it("copies a number as text and an absent value as empty text", () => {
    const form = cardFormFromCard(makeAdminCard());
    expect(applyFieldValue(form, "might", 7).might).toBe("7");
    expect(applyFieldValue(form, "mightBonus", null).mightBonus).toBe("");
  });
});
