import { beforeEach, describe, expect, it } from "vitest";

import {
  makeAdminCardDetail,
  makeCandidateCard,
  makeCandidatePrinting,
  makeProviderSetting,
  resetIdCounter,
} from "@/test/factories";

import { buildOverviewSourceGroups } from "./source-groups";

const CHECKED = "2026-09-01T00:00:00.000Z";

beforeEach(() => {
  resetIdCounter();
});

describe("buildOverviewSourceGroups", () => {
  it("folds several rows of one provider into a single row", () => {
    const detail = makeAdminCardDetail({
      sources: [
        makeCandidateCard({ provider: "gallery", checkedAt: CHECKED }),
        makeCandidateCard({ provider: "gallery", checkedAt: CHECKED }),
        makeCandidateCard({ provider: "gallery", checkedAt: CHECKED }),
      ],
    });
    const groups = buildOverviewSourceGroups(detail, []);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.rowCount).toBe(3);
  });

  it("keeps contributors apart by name", () => {
    const detail = makeAdminCardDetail({
      sources: [
        makeCandidateCard({ submittedByName: "Renata" }),
        makeCandidateCard({ submittedByName: "Ekko" }),
        makeCandidateCard({ submittedByName: "Renata" }),
      ],
    });
    const groups = buildOverviewSourceGroups(detail, []);
    expect(groups.map((group) => group.label)).toEqual(["Renata", "Ekko"]);
    expect(groups[0]?.rowCount).toBe(2);
    expect(groups[0]?.isContributor).toBe(true);
  });

  it("counts as checked only when every row is checked", () => {
    const detail = makeAdminCardDetail({
      sources: [
        makeCandidateCard({ provider: "gallery", checkedAt: CHECKED }),
        makeCandidateCard({ provider: "gallery", checkedAt: null }),
      ],
    });
    expect(buildOverviewSourceGroups(detail, [])[0]?.isChecked).toBe(false);
  });

  it("counts as unchecked while one of its printings is unchecked", () => {
    const source = makeCandidateCard({ provider: "gallery", checkedAt: CHECKED });
    const detail = makeAdminCardDetail({
      sources: [source],
      candidatePrintings: [
        makeCandidatePrinting({ candidateCardId: source.id, checkedAt: CHECKED }),
        makeCandidatePrinting({ candidateCardId: source.id, checkedAt: null }),
      ],
    });
    expect(buildOverviewSourceGroups(detail, [])[0]?.isChecked).toBe(false);
  });

  it("marks a favourite provider as trusted", () => {
    const detail = makeAdminCardDetail({
      sources: [makeCandidateCard({ provider: "gallery" })],
    });
    const groups = buildOverviewSourceGroups(detail, [
      makeProviderSetting({ provider: "gallery", isFavorite: true }),
    ]);
    expect(groups[0]?.isTrusted).toBe(true);
  });
});
