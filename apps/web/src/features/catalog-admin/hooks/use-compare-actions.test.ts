import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  makeAdminCard,
  makeAdminCardDetail,
  makeAdminPrinting,
  makeCandidateCard,
  makeCandidatePrinting,
  resetIdCounter,
} from "@/test/factories";

const mocks = vi.hoisted(() => {
  const recorded = new Map<string, unknown[]>();
  const record = (name: string) => (vars: unknown) => {
    recorded.set(name, [...(recorded.get(name) ?? []), vars]);
  };
  const hook = (name: string) => () => ({ mutate: record(name), isPending: false });
  return { recorded, hook };
});

vi.mock("@/features/admin/hooks/use-admin-card-mutations", () => ({
  useAcceptCardField: mocks.hook("acceptCardField"),
  useAcceptPrintingField: mocks.hook("acceptPrintingField"),
  useAcceptPrintingGroup: mocks.hook("acceptPrintingGroup"),
  useCheckAllCandidatePrintings: mocks.hook("checkAllCandidatePrintings"),
  useCheckCandidateCard: mocks.hook("checkCandidateCard"),
  useCheckCandidatePrinting: mocks.hook("checkCandidatePrinting"),
  useCopyCandidatePrinting: mocks.hook("copyCandidatePrinting"),
  useLinkCandidatePrintings: mocks.hook("linkCandidatePrintings"),
}));

vi.mock("@/features/admin/hooks/use-admin-image-mutations", () => ({
  useActivatePrintingImage: mocks.hook("activatePrintingImage"),
  useSetCandidatePrintingImage: mocks.hook("setCandidatePrintingImage"),
}));

vi.mock("@/features/admin/hooks/use-ignored-candidates", () => ({
  useIgnoreCandidateCard: mocks.hook("ignoreCandidateCard"),
  useIgnoreCandidatePrinting: mocks.hook("ignoreCandidatePrinting"),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), warning: vi.fn() },
}));

const { toast } = await import("sonner");
const { buildCompareColumns } = await import("@/features/catalog-admin/lib/compare-columns");
const { buildCompareModel } = await import("@/features/catalog-admin/lib/compare-rows");
const { useCompareActions } = await import("./use-compare-actions");

function calls(name: string): unknown[] {
  return mocks.recorded.get(name) ?? [];
}

function setup(detail: ReturnType<typeof makeAdminCardDetail>) {
  const columns = buildCompareColumns(detail, []);
  const model = buildCompareModel(detail, columns);
  const { result } = renderHook(() =>
    useCompareActions({ detail, cardSlug: "OGN-001", columns, model }),
  );
  return { actions: result.current, columns, model };
}

function undoFromLastToast(): () => void {
  const call = vi.mocked(toast.success).mock.calls.at(-1);
  const options = call?.[1] as { action?: { onClick: () => void } } | undefined;
  if (!options?.action) {
    throw new Error("expected an Undo action on the toast");
  }
  return options.action.onClick;
}

beforeEach(() => {
  resetIdCounter();
  mocks.recorded.clear();
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.warning).mockClear();
});

describe("applyCardValue", () => {
  it("writes the source value, then undoes it back to the site value", () => {
    const gallery = makeCandidateCard({ provider: "gallery", name: "Lux, Lady of Dawn" });
    const card = makeAdminCard({ name: "Lux, Lady of Luminosity" });
    const detail = makeAdminCardDetail({ card, sources: [gallery] });
    const { actions, model } = setup(detail);

    const row = model.cardRows.find((entry) => entry.field === "name");
    if (!row) {
      throw new Error("expected a name row");
    }
    actions.applyCardValue(row, gallery.id, "gallery");

    expect(calls("acceptCardField")).toEqual([
      { cardId: card.id, field: "name", value: "Lux, Lady of Dawn", source: "provider" },
    ]);
    expect(vi.mocked(toast.success).mock.calls.at(-1)?.[0]).toBe("Used Name from gallery");

    undoFromLastToast()();
    expect(calls("acceptCardField").at(-1)).toEqual({
      cardId: card.id,
      field: "name",
      value: "Lux, Lady of Luminosity",
      source: "manual",
    });
  });

  it("writes nothing when the column has no cell on that row", () => {
    const detail = makeAdminCardDetail({
      sources: [makeCandidateCard({ provider: "gallery", name: "Lux, Lady of Dawn" })],
    });
    const { actions, model } = setup(detail);
    const row = model.cardRows[0];
    if (!row) {
      throw new Error("expected a card row");
    }
    actions.applyCardValue(row, "no-such-column", "gallery");
    expect(calls("acceptCardField")).toEqual([]);
  });
});

describe("applyAllFromColumn", () => {
  it("fans the differing card and printing values out and counts them in the toast", () => {
    const gallery = makeCandidateCard({
      provider: "gallery",
      name: "Lux, Lady of Dawn",
      might: 3,
    });
    const card = makeAdminCard({ name: "Lux, Lady of Luminosity", might: 3 });
    const printing = makeAdminPrinting({ artist: "Sixmorevodka" });
    const detail = makeAdminCardDetail({
      card,
      sources: [gallery],
      printings: [printing],
      candidatePrintings: [
        makeCandidatePrinting({
          candidateCardId: gallery.id,
          printingId: printing.id,
          artist: "Kudos Productions",
        }),
      ],
    });
    const { actions } = setup(detail);

    actions.applyAllFromColumn(gallery.id);

    expect(calls("acceptCardField")).toEqual([
      { cardId: card.id, field: "name", value: "Lux, Lady of Dawn", source: "provider" },
    ]);
    expect(calls("acceptPrintingField")).toEqual([
      {
        printingId: printing.id,
        field: "artist",
        value: "Kudos Productions",
        source: "provider",
      },
    ]);
    expect(vi.mocked(toast.success).mock.calls.at(-1)?.[0]).toBe("Used 2 values from gallery");
  });
});

describe("ignoring rows", () => {
  it("resolves the row's own source before ignoring it", () => {
    const gallery = makeCandidateCard({ provider: "gallery" });
    const candidate = makeCandidatePrinting({
      candidateCardId: gallery.id,
      externalId: "ogn-001-foil",
      finish: "foil",
    });
    const detail = makeAdminCardDetail({ sources: [gallery], candidatePrintings: [candidate] });
    const { actions } = setup(detail);

    actions.ignoreRow(candidate.id);

    expect(calls("ignoreCandidatePrinting")).toEqual([
      { provider: "gallery", externalId: "ogn-001-foil", finish: "foil" },
    ]);
    expect(vi.mocked(toast.success).mock.calls.at(-1)?.[0]).toBe("Ignored 1 row");
  });

  it("says so instead of failing silently when no row resolves", () => {
    const detail = makeAdminCardDetail({ sources: [makeCandidateCard({ provider: "gallery" })] });
    const { actions } = setup(detail);

    actions.ignoreRows([makeCandidatePrinting({ candidateCardId: "gone" })]);

    expect(calls("ignoreCandidatePrinting")).toEqual([]);
    expect(vi.mocked(toast.warning).mock.calls.at(-1)?.[0]).toBe("Nothing to ignore here");
  });
});

describe("addPrinting", () => {
  it("links every row of the group and applies the filled-in values", () => {
    const gallery = makeCandidateCard({ provider: "gallery" });
    const other = makeCandidateCard({ provider: "playloltcg" });
    const card = makeAdminCard();
    const first = makeCandidatePrinting({ candidateCardId: gallery.id, artist: null });
    const second = makeCandidatePrinting({ candidateCardId: other.id });
    const detail = makeAdminCardDetail({
      card,
      sources: [gallery, other],
      candidatePrintings: [first, second],
    });
    const { actions } = setup(detail);

    actions.addPrinting(first, [first, second], { artist: "Sixmorevodka" });

    const sent = calls("acceptPrintingGroup").at(0) as {
      cardId: string;
      printingFields: { artist: string };
      candidatePrintingIds: string[];
    };
    expect(sent.cardId).toBe(card.id);
    expect(sent.printingFields.artist).toBe("Sixmorevodka");
    expect(sent.candidatePrintingIds).toEqual([first.id, second.id]);
  });
});

describe("applySourceImage", () => {
  it("offers an undo that re-activates the image the printing had", () => {
    const detail = makeAdminCardDetail({ sources: [makeCandidateCard({ provider: "gallery" })] });
    const { actions } = setup(detail);

    actions.applySourceImage("candidate-1", "image-1");

    expect(calls("setCandidatePrintingImage")).toEqual([
      { candidatePrintingId: "candidate-1", mode: "main" },
    ]);
    undoFromLastToast()();
    expect(calls("activatePrintingImage")).toEqual([{ imageId: "image-1", active: true }]);
  });

  it("still says what happened when the printing had no image", () => {
    const detail = makeAdminCardDetail({ sources: [makeCandidateCard({ provider: "gallery" })] });
    const { actions } = setup(detail);

    actions.applySourceImage("candidate-1", null);

    expect(vi.mocked(toast.success).mock.calls.at(-1)?.[1]).toBeUndefined();
  });
});
