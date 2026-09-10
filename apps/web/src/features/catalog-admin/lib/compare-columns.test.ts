import { beforeEach, describe, expect, it } from "vitest";

import {
  makeAdminCardDetail,
  makeCandidateCard,
  makeCandidatePrinting,
  makeProviderSetting,
  resetIdCounter,
} from "@/test/factories";

import { buildCompareColumns } from "./compare-columns";

beforeEach(() => {
  resetIdCounter();
});

describe("buildCompareColumns", () => {
  it("orders columns by the Sources page order, trust only marks them", () => {
    const detail = makeAdminCardDetail({
      sources: [
        makeCandidateCard({ provider: "playloltcg" }),
        makeCandidateCard({ provider: "gallery" }),
        makeCandidateCard({ provider: "riftmarket" }),
      ],
    });
    const columns = buildCompareColumns(detail, [
      makeProviderSetting({ provider: "playloltcg", sortOrder: 3 }),
      makeProviderSetting({ provider: "gallery", sortOrder: 2, isFavorite: true }),
      makeProviderSetting({ provider: "riftmarket", sortOrder: 1 }),
    ]);
    expect(columns.map((column) => column.provider)).toEqual([
      "riftmarket",
      "gallery",
      "playloltcg",
    ]);
    expect(columns.map((column) => column.isTrusted)).toEqual([false, true, false]);
  });

  it("labels a contributor source with the submitter name", () => {
    const detail = makeAdminCardDetail({
      sources: [makeCandidateCard({ submittedByName: "Renata" })],
    });
    const columns = buildCompareColumns(detail, []);
    expect(columns[0]?.label).toBe("Renata");
    expect(columns[0]?.isContributor).toBe(true);
  });

  it("falls back to Contributor when the account is gone", () => {
    const detail = makeAdminCardDetail({
      sources: [makeCandidateCard({ submittedByName: null })],
    });
    expect(buildCompareColumns(detail, [])[0]?.label).toBe("Contributor");
  });

  it("counts a source as checked only when its rows are checked too", () => {
    const checked = makeCandidateCard({
      provider: "gallery",
      checkedAt: "2026-09-01T00:00:00.000Z",
    });
    const stillOpen = makeCandidateCard({
      provider: "playloltcg",
      checkedAt: "2026-09-01T00:00:00.000Z",
    });
    const detail = makeAdminCardDetail({
      sources: [checked, stillOpen],
      candidatePrintings: [
        makeCandidatePrinting({
          candidateCardId: checked.id,
          checkedAt: "2026-09-01T00:00:00.000Z",
        }),
        makeCandidatePrinting({ candidateCardId: stillOpen.id, checkedAt: null }),
      ],
    });
    const columns = buildCompareColumns(detail, []);
    expect(columns.find((column) => column.provider === "gallery")?.isChecked).toBe(true);
    expect(columns.find((column) => column.provider === "playloltcg")?.isChecked).toBe(false);
  });

  it("drops hidden columns and, on the unchecked filter, settled ones", () => {
    const hiddenSource = makeCandidateCard({ provider: "gallery" });
    const settled = makeCandidateCard({
      provider: "playloltcg",
      checkedAt: "2026-09-01T00:00:00.000Z",
    });
    const open = makeCandidateCard({ provider: "riftmarket" });
    const detail = makeAdminCardDetail({ sources: [hiddenSource, settled, open] });

    expect(
      buildCompareColumns(detail, [], { hidden: new Set([hiddenSource.id]) }).map(
        (column) => column.provider,
      ),
    ).toEqual(["playloltcg", "riftmarket"]);
    expect(
      buildCompareColumns(detail, [], { uncheckedOnly: true }).map((column) => column.provider),
    ).toEqual(["gallery", "riftmarket"]);
  });

  it("drops a provider that is switched off for review", () => {
    const detail = makeAdminCardDetail({
      sources: [
        makeCandidateCard({ provider: "gallery" }),
        makeCandidateCard({ provider: "riftmarket" }),
      ],
    });
    const columns = buildCompareColumns(detail, [
      makeProviderSetting({ provider: "riftmarket", isHidden: true }),
    ]);
    expect(columns.map((column) => column.provider)).toEqual(["gallery"]);
  });

  it("lists the row ids a source contributes, unchecked ones separately", () => {
    const source = makeCandidateCard({ provider: "gallery" });
    const open = makeCandidatePrinting({ candidateCardId: source.id, checkedAt: null });
    const done = makeCandidatePrinting({
      candidateCardId: source.id,
      checkedAt: "2026-09-01T00:00:00.000Z",
    });
    const detail = makeAdminCardDetail({
      sources: [source],
      candidatePrintings: [open, done],
    });
    const column = buildCompareColumns(detail, [])[0];
    expect(column?.candidatePrintingIds).toEqual([open.id, done.id]);
    expect(column?.uncheckedPrintingIds).toEqual([open.id]);
  });
});
