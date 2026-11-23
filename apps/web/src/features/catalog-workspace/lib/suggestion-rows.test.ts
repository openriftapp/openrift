import { beforeEach, describe, expect, it } from "vitest";

import { buildAttentionSubmissions } from "@/features/admin/lib/attention-items";
import {
  makeAdminCard,
  makeAdminCardDetail,
  makeCandidateCard,
  makeProviderSetting,
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

    expect(result.suggestions.map((s) => [s.field, s.tone, s.sourceLabel])).toEqual([
      ["name", "source", "gallery"],
      ["might", "source", "gallery"],
      ["might", "contributor", "Renata"],
    ]);
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
    expect(result.enterTargets.map((target) => target.differences)).toEqual([1, 0]);
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
