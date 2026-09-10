import { beforeEach, describe, expect, it } from "vitest";

import {
  makeAdminCard,
  makeAdminCardDetail,
  makeCandidateCard,
  resetIdCounter,
} from "@/test/factories";

import { buildCompareColumns } from "./compare-columns";
import { buildSourceDiff } from "./field-source-diff";

beforeEach(() => {
  resetIdCounter();
});

function diffFor(
  detail: ReturnType<typeof makeAdminCardDetail>,
  optionSets: Record<string, readonly string[]> = {},
) {
  return buildSourceDiff(detail, buildCompareColumns(detail, []), optionSets);
}

describe("buildSourceDiff", () => {
  it("keeps only the fields a source disagrees on", () => {
    const detail = makeAdminCardDetail({
      card: makeAdminCard({ name: "Lux, Lady of Luminosity", energy: 2 }),
      sources: [
        makeCandidateCard({
          provider: "gallery",
          name: "Lux, Lady of Luminosity",
          energy: 4,
        }),
      ],
    });
    const diff = diffFor(detail);
    expect(diff.rows.map((row) => row.field)).toEqual(["energy"]);
    expect(diff.rows[0]?.siteValue).toBe(2);
  });

  it("drops a source that agrees everywhere", () => {
    const detail = makeAdminCardDetail({
      card: makeAdminCard({ energy: 2 }),
      sources: [
        makeCandidateCard({ provider: "gallery", energy: 2 }),
        makeCandidateCard({ provider: "playloltcg", energy: 4 }),
      ],
    });
    const diff = diffFor(detail);
    expect(diff.columns.map((column) => column.provider)).toEqual(["playloltcg"]);
    expect(diff.rows[0]?.cells).toHaveLength(1);
  });

  it("returns nothing when every source matches the site", () => {
    const detail = makeAdminCardDetail({
      card: makeAdminCard(),
      sources: [makeCandidateCard({ provider: "gallery" })],
    });
    const diff = diffFor(detail);
    expect(diff.rows).toEqual([]);
    expect(diff.columns).toEqual([]);
  });

  it("does not offer a value the catalog does not know", () => {
    const detail = makeAdminCardDetail({
      card: makeAdminCard({ domains: ["calm"] }),
      sources: [makeCandidateCard({ provider: "gallery", domains: ["moonlight"] })],
    });
    expect(diffFor(detail, { domains: ["calm", "fury"] }).rows).toEqual([]);
    expect(diffFor(detail).rows.map((row) => row.field)).toEqual(["domains"]);
  });

  it("keeps a known value from a source that also sends an unknown one", () => {
    const detail = makeAdminCardDetail({
      card: makeAdminCard({ domains: ["calm"], types: ["unit"] }),
      sources: [
        makeCandidateCard({ provider: "gallery", domains: ["moonlight"], types: ["spell"] }),
      ],
    });
    const diff = diffFor(detail, { domains: ["calm", "fury"], types: ["unit", "spell"] });
    expect(diff.rows.map((row) => row.field)).toEqual(["types"]);
    expect(diff.columns).toHaveLength(1);
  });

  it("ignores a source that has no value for the field", () => {
    const detail = makeAdminCardDetail({
      card: makeAdminCard({ tags: ["azir"] }),
      sources: [makeCandidateCard({ provider: "gallery", tags: [] })],
    });
    expect(diffFor(detail).rows).toEqual([]);
  });
});
