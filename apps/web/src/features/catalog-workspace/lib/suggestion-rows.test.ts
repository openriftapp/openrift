import { beforeEach, describe, expect, it } from "vitest";

import { buildAttentionSubmissions } from "@/features/admin/lib/attention-items";
import {
  makeAdminCard,
  makeAdminCardDetail,
  makeCandidateCard,
  makeProviderSetting,
  resetIdCounter,
} from "@/test/factories";

import {
  buildCardSuggestions,
  discardLabel,
  enterDifferenceCount,
  enterProviders,
  sameDifferenceInput,
  suggestionByHotkey,
} from "./suggestion-rows";

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

function build(sources: ReturnType<typeof makeCandidateCard>[], favorites: string[] = []) {
  const detail = makeAdminCardDetail({ card, sources });
  return buildCardSuggestions(
    detail,
    favorites.map((provider) => makeProviderSetting({ provider, isFavorite: true })),
    buildAttentionSubmissions(detail, []),
  );
}

describe("buildCardSuggestions", () => {
  it("lists a suggestion only where the source value differs from the card", () => {
    const result = build([sameAsCard({ name: "Jinx - Demolitionist" })]);

    expect(result.suggestions.map((s) => [s.field, s.value])).toEqual([
      ["name", "Jinx - Demolitionist"],
    ]);
    expect(result.rows.find((row) => row.field === "might")?.suggestions).toEqual([]);
    expect(result.agreedLabels).not.toContain("Name");
    expect(result.agreedLabels).toContain("Might");
  });

  it("skips checked source rows", () => {
    const result = build([
      sameAsCard({ name: "Jinx - Demolitionist", checkedAt: "2026-10-01T00:00:00.000Z" }),
    ]);

    expect(result.suggestions).toEqual([]);
    expect(result.enterTargets).toEqual([]);
    expect(result.sources).toEqual([]);
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

    expect(result.suggestions.map((s) => [s.field, s.tone, s.hotkey])).toEqual([
      ["name", "source", 1],
      ["might", "source", 2],
      ["might", "contributor", 3],
    ]);
    expect(suggestionByHotkey(result.suggestions, 3)?.sourceLabel).toBe("Renata");
  });

  it("leaves suggestions past the ninth without a hotkey", () => {
    const sources = Array.from({ length: 10 }, (_, index) =>
      sameAsCard({ provider: `provider-${index}`, name: `Jinx ${index}` }),
    );
    const result = build(sources);

    expect(result.suggestions).toHaveLength(10);
    expect(result.suggestions.at(8)?.hotkey).toBe(9);
    expect(result.suggestions.at(9)?.hotkey).toBeUndefined();
  });

  it("counts differences per provider and marks trusted ones", () => {
    const result = build(
      [
        sameAsCard({ provider: "gallery" }),
        sameAsCard({ provider: "scans", name: "Jinx - Demolitionist", might: 3 }),
      ],
      ["gallery"],
    );

    expect(result.sources).toEqual([
      { key: "gallery", label: "gallery", tone: "source", differences: 0, trusted: true },
      { key: "scans", label: "scans", tone: "source", differences: 2, trusted: false },
    ]);
  });

  it("sums several rows of one provider into one strip entry", () => {
    const result = build([
      sameAsCard({ provider: "scans", name: "Jinx A" }),
      sameAsCard({ provider: "scans", might: 1 }),
    ]);

    expect(result.sources).toEqual([
      { key: "scans", label: "scans", tone: "source", differences: 2, trusted: false },
    ]);
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
    expect(enterProviders(result.enterTargets)).toEqual(["scans"]);
    expect(enterDifferenceCount(result.enterTargets)).toBe(1);
    expect(result.openContributorIds).toEqual(["sub-1"]);
  });

  it("carries the submission's change key and its other open changes", () => {
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
    expect(might?.otherChanges).toBe(1);
    expect(result.sources).toEqual([
      {
        key: "contributor:sub-1",
        label: "Renata",
        tone: "contributor",
        differences: 2,
        trusted: false,
      },
    ]);
  });
});

describe("discardLabel", () => {
  it("says Discard when the source has one difference here", () => {
    const [suggestion] = build([sameAsCard({ name: "Jinx A" })]).suggestions;
    expect(suggestion && discardLabel(suggestion)).toBe("Discard");
  });

  it("names the count and source when it has more", () => {
    const [suggestion] = build([
      sameAsCard({ provider: "scans", name: "Jinx A", might: 1 }),
    ]).suggestions;
    expect(suggestion && discardLabel(suggestion)).toBe("Discard 2 from scans");
  });
});

describe("sameDifferenceInput", () => {
  it("encodes a source suggestion's provider, field and JSON value", () => {
    const [suggestion] = build([sameAsCard({ might: 6 })]).suggestions;
    expect(suggestion && sameDifferenceInput(suggestion)).toEqual({
      provider: "gallery",
      field: "might",
      value: "6",
    });
  });

  it("encodes list values as JSON arrays", () => {
    const [suggestion] = build([sameAsCard({ tags: ["Zaun"] })]).suggestions;
    expect(suggestion && sameDifferenceInput(suggestion)?.value).toBe('["Zaun"]');
  });

  it("returns null for a contributor proposal", () => {
    expect(
      sameDifferenceInput({
        key: "card.might",
        field: "might",
        tone: "contributor",
        sourceKey: "contributor:cc-1",
        sourceLabel: "Ezreal",
        value: 6,
        candidateRowId: "cc-1",
        rowDifferences: 1,
      }),
    ).toBeNull();
  });
});
