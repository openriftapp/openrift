import { beforeEach, describe, expect, it } from "vitest";

import { buildAttentionSubmissions } from "@/features/admin/lib/attention-items";
import {
  makeAdminCard,
  makeAdminCardDetail,
  makeCandidateCard,
  resetIdCounter,
} from "@/test/factories";

import { buildCardSuggestions } from "./suggestion-rows";

beforeEach(() => {
  resetIdCounter();
});

const card = makeAdminCard({ name: "Jinx, Demolitionist", might: 4, energy: 5 });

function sameAsCard(overrides: Parameters<typeof makeCandidateCard>[0] = {}) {
  return makeCandidateCard({
    provider: "gallery",
    name: card.name,
    types: card.types,
    superTypes: card.superTypes,
    domains: card.domains,
    might: card.might,
    energy: card.energy,
    power: card.power,
    mightBonus: card.mightBonus,
    tags: card.tags,
    ...overrides,
  });
}

function build(sources: ReturnType<typeof makeCandidateCard>[]) {
  const detail = makeAdminCardDetail({ card, sources });
  const result = buildCardSuggestions(detail, buildAttentionSubmissions(detail, []));
  return { ...result, suggestions: result.rows.flatMap((row) => row.suggestions) };
}

describe("buildCardSuggestions", () => {
  it("lists a suggestion only where the source value differs from the card", () => {
    const result = build([sameAsCard({ name: "Jinx - Demolitionist" })]);

    expect(result.suggestions.map((s) => [s.field, s.proposed])).toEqual([
      ["name", "Jinx - Demolitionist"],
    ]);
    expect(result.rows.find((row) => row.field === "might")?.suggestions).toEqual([]);
  });

  it("skips checked source rows", () => {
    const result = build([
      sameAsCard({ name: "Jinx - Demolitionist", checkedAt: "2026-10-01T00:00:00.000Z" }),
    ]);

    expect(result.suggestions).toEqual([]);
    expect(result.enterTargets).toEqual([]);
  });

  it("skips empty source values", () => {
    const result = build([sameAsCard({ might: null, tags: [] })]);

    expect(result.suggestions).toEqual([]);
  });

  it("numbers suggestions 1 to 9 in field order across sources and contributors", () => {
    const result = build([
      sameAsCard({ provider: "gallery", name: "Jinx - Demolitionist", might: 3 }),
      makeCandidateCard({
        ...sameAsCard(),
        id: "sub-1",
        provider: "usersubmission",
        submittedByName: "Renata",
        might: 2,
      }),
    ]);

    expect(result.suggestions.map((s) => [s.field, s.isContributor, s.sourceLabel])).toEqual([
      ["name", false, "gallery"],
      ["might", false, "gallery"],
      ["might", true, "Renata"],
    ]);
  });

  it("skips a value dismissed on the source row", () => {
    const result = build([
      sameAsCard({
        name: "Jinx - Demolitionist",
        dismissedValues: { name: "Jinx - Demolitionist" },
      }),
    ]);

    expect(result.suggestions).toEqual([]);
  });

  it("keeps contributor rows out of the Enter targets", () => {
    const source = sameAsCard({ provider: "scans", name: "Jinx A" });
    const quiet = sameAsCard({ provider: "gallery" });
    const submission = makeCandidateCard({ ...sameAsCard(), id: "sub-1", might: 2 });
    submission.provider = "usersubmission";
    const result = build([source, quiet, submission]);

    expect(result.enterTargets.map((target) => target.candidateRowId)).toEqual([
      source.id,
      quiet.id,
    ]);
    expect(result.enterTargets.map((target) => target.differences)).toEqual([1, 0]);
  });

  it("carries the submission's change key", () => {
    const submission = makeCandidateCard({
      ...sameAsCard(),
      id: "sub-1",
      provider: "usersubmission",
      might: 2,
      energy: 1,
    });
    const result = build([submission]);
    const might = result.suggestions.find((s) => s.field === "might");

    expect(might?.changeKey).toBe("card:sub-1:might");
    expect(might?.candidateCardId).toBe("sub-1");
  });
});
