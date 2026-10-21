import type { StagedProductResponse } from "@openrift/shared/types/api/admin";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { toastFieldAccepted } from "@/features/admin/lib/accept-undo";
import type { RecordActions } from "@/features/catalog-workspace/hooks/use-register-record-actions";
import type { ListingSuggestion } from "@/features/catalog-workspace/lib/printing-suggestion-rows";
import { buildPrintingSuggestions } from "@/features/catalog-workspace/lib/printing-suggestion-rows";
import {
  makeAdminCardDetail,
  makeAdminPrinting,
  makeCandidateCard,
  makeCandidatePrinting,
  resetIdCounter,
} from "@/test/factories";

function mutation() {
  return { mutate: vi.fn(), mutateAsync: vi.fn(async () => {}), isPending: false };
}

const mocks = vi.hoisted(() => ({
  acceptField: { current: null as ReturnType<typeof mutation> | null },
  checkAll: { current: null as ReturnType<typeof mutation> | null },
  save: { current: null as ReturnType<typeof mutation> | null },
  ignore: { current: null as ReturnType<typeof mutation> | null },
  generic: { current: null as ReturnType<typeof mutation> | null },
  registered: { current: null as RecordActions | null },
}));

vi.mock("@/features/admin/hooks/use-admin-card-mutations", () => ({
  useAcceptPrintingField: () => mocks.acceptField.current,
  useCheckCandidatePrinting: () => mocks.generic.current,
  useCheckAllCandidatePrintings: () => mocks.checkAll.current,
}));
vi.mock("@/features/admin/hooks/use-catalog-review", () => ({
  useAcceptSubmission: () => mocks.generic.current,
  useRejectSubmission: () => mocks.generic.current,
}));
vi.mock("@/features/admin/hooks/use-unified-mappings", () => ({
  useUnifiedSaveMappings: () => mocks.save.current,
  useUnifiedIgnoreVariants: () => mocks.ignore.current,
}));
vi.mock("@/features/admin/lib/accept-undo", () => ({ toastFieldAccepted: vi.fn() }));
vi.mock("@/features/catalog-workspace/hooks/use-register-record-actions", () => ({
  useRegisterRecordActions: (actions: RecordActions) => {
    mocks.registered.current = actions;
  },
}));

const { printingChips, usePrintingRecordActions } = await import("./use-printing-record-actions");

const CONTEXT = { costKeywords: [], setTotals: {} };

const LISTING: ListingSuggestion = {
  key: "tcgplayer::7::normal::",
  marketplace: "tcgplayer",
  product: { externalId: 7, finish: "normal", language: null } as StagedProductResponse,
  score: 180,
};

function setup() {
  const source = makeCandidateCard({ provider: "provider-a" });
  const candidate = makeCandidatePrinting({
    candidateCardId: source.id,
    printingId: "p1",
    size: "oversized",
  });
  const detail = makeAdminCardDetail({
    sources: [source],
    printings: [makeAdminPrinting({ id: "p1" })],
    candidatePrintings: [candidate],
  });
  return { model: buildPrintingSuggestions([detail], "p1", CONTEXT), candidate };
}

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  resetIdCounter();
  mocks.acceptField.current = mutation();
  mocks.checkAll.current = mutation();
  mocks.save.current = mutation();
  mocks.ignore.current = mutation();
  mocks.generic.current = mutation();
  mocks.registered.current = null;
});

describe("printingChips", () => {
  it("puts field suggestions before listings", () => {
    const { model } = setup();
    expect(printingChips(model, [LISTING]).map((chip) => chip.kind)).toEqual(["field", "listing"]);
  });
});

describe("usePrintingRecordActions", () => {
  it("checks the sources with a printing-level difference on Enter", async () => {
    const { model, candidate } = setup();
    const client = new QueryClient();
    renderHook(
      () =>
        usePrintingRecordActions({
          printingId: "p1",
          model,
          listings: [LISTING],
          canCheck: true,
          canMap: true,
        }),
      { wrapper: wrapper(client) },
    );

    await mocks.registered.current?.primary?.run();
    expect(mocks.checkAll.current?.mutateAsync).toHaveBeenCalledWith({ extraIds: [candidate.id] });
  });

  it("maps the listing with the number key and refreshes the queue once it settles", () => {
    const { model } = setup();
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    renderHook(
      () =>
        usePrintingRecordActions({
          printingId: "p1",
          model,
          listings: [LISTING],
          canCheck: true,
          canMap: true,
        }),
      { wrapper: wrapper(client) },
    );

    mocks.registered.current?.useSuggestion?.(2);
    const [variables, options] = mocks.save.current!.mutate.mock.calls[0] as [
      unknown,
      { onSettled: () => void },
    ];
    expect(variables).toEqual({
      mappings: [{ externalId: 7, finish: "normal", language: null, printingId: "p1" }],
    });
    options.onSettled();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin", "workspace"] });
  });

  it("hides listings from holders who cannot map and keeps Enter as plain Next", () => {
    const { model } = setup();
    const client = new QueryClient();
    const { result } = renderHook(
      () =>
        usePrintingRecordActions({
          printingId: "p1",
          model,
          listings: [LISTING],
          canCheck: false,
          canMap: false,
        }),
      { wrapper: wrapper(client) },
    );

    expect(result.current.chips.map((chip) => chip.kind)).toEqual(["field"]);
    expect(mocks.registered.current?.primary).toBeUndefined();
  });

  it("ignores a listing as one SKU", () => {
    const { model } = setup();
    const client = new QueryClient();
    const { result } = renderHook(
      () =>
        usePrintingRecordActions({
          printingId: "p1",
          model,
          listings: [LISTING],
          canCheck: true,
          canMap: true,
        }),
      { wrapper: wrapper(client) },
    );

    result.current.ignoreListing(LISTING);
    expect(mocks.ignore.current?.mutate).toHaveBeenCalledWith(
      [{ externalId: 7, finish: "normal", language: null }],
      expect.objectContaining({ onSettled: expect.any(Function) }),
    );
  });

  it("sends a source's release date together with its precision", () => {
    const source = makeCandidateCard({ provider: "provider-a" });
    const candidate = makeCandidatePrinting({
      candidateCardId: source.id,
      printingId: "p1",
      releasedAt: "2026-11-01",
      releasePrecision: "month",
    });
    const detail = makeAdminCardDetail({
      sources: [source],
      printings: [
        makeAdminPrinting({ id: "p1", releasedAt: "2026-01-01", releasePrecision: "year" }),
      ],
      candidatePrintings: [candidate],
    });
    const model = buildPrintingSuggestions([detail], "p1", CONTEXT);
    const client = new QueryClient();
    const { result } = renderHook(
      () =>
        usePrintingRecordActions({
          printingId: "p1",
          model,
          listings: [],
          canCheck: true,
          canMap: true,
        }),
      { wrapper: wrapper(client) },
    );

    const chip = result.current.chips.find(
      (entry) => entry.kind === "field" && entry.suggestion.field === "releasedAt",
    );
    result.current.applyChip(chip!);
    expect(mocks.acceptField.current?.mutate).toHaveBeenCalledWith({
      printingId: "p1",
      field: "releasedAt",
      value: { releasedAt: "2026-11-01", releasePrecision: "month" },
      source: "provider",
    });
    expect(vi.mocked(toastFieldAccepted).mock.lastCall?.[0].previousValue).toEqual({
      releasedAt: "2026-01-01",
      releasePrecision: "year",
    });
  });

  it("sends any other field's proposed value as is", () => {
    const { model } = setup();
    const client = new QueryClient();
    const { result } = renderHook(
      () =>
        usePrintingRecordActions({
          printingId: "p1",
          model,
          listings: [],
          canCheck: true,
          canMap: true,
        }),
      { wrapper: wrapper(client) },
    );

    result.current.applyChip(result.current.chips[0]!);
    expect(mocks.acceptField.current?.mutate).toHaveBeenCalledWith({
      printingId: "p1",
      field: "size",
      value: "oversized",
      source: "provider",
    });
  });
});
