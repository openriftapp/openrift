import type { StagedProductResponse } from "@openrift/shared/types/api/admin";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { acceptFieldWithUndo } from "@/features/admin/lib/accept-undo";
import type { RecordActions } from "@/features/catalog-workspace/hooks/use-register-record-actions";
import type { ListingSuggestion } from "@/features/catalog-workspace/lib/printing-suggestion-rows";
import { buildPrintingSuggestions } from "@/features/catalog-workspace/lib/printing-suggestion-rows";
import { useWorkspaceSelectionStore } from "@/features/catalog-workspace/stores/workspace-selection-store";
import {
  makeAdminCardDetail,
  makeAdminPrinting,
  makeCandidateCard,
  makeCandidatePrinting,
  resetIdCounter,
} from "@/test/factories";
import { createStoreResetter } from "@/test/store-helpers";

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
  acceptPrintingFieldFn: vi.fn((_input: unknown) => Promise.resolve()),
  uncheckFn: vi.fn((_input: unknown) => Promise.resolve()),
  unmapFn: vi.fn((_input: unknown) => Promise.resolve()),
  unignoreFn: vi.fn((_input: unknown) => Promise.resolve()),
}));

vi.mock("@/features/admin/hooks/use-admin-card-mutations", () => ({
  acceptPrintingFieldFn: mocks.acceptPrintingFieldFn,
  uncheckCandidatePrintingFn: mocks.uncheckFn,
  unmapMarketplacePrintingFn: mocks.unmapFn,
  useAcceptPrintingField: () => mocks.acceptField.current,
  useCheckCandidatePrinting: () => mocks.generic.current,
  useCheckAllCandidatePrintings: () => mocks.checkAll.current,
}));
vi.mock("@/features/admin/hooks/use-ignored-products", () => ({
  unignoreProductFn: mocks.unignoreFn,
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn() }) }));
vi.mock("@/features/admin/hooks/use-catalog-review", () => ({
  useAcceptSubmission: () => mocks.generic.current,
}));
vi.mock("@/features/admin/hooks/use-unified-mappings", () => ({
  useSaveMappingsByMarketplace: () => ({
    tcgplayer: mocks.save.current,
    cardmarket: mocks.save.current,
    cardtrader: mocks.save.current,
    cardnexus: mocks.save.current,
  }),
  useIgnoreVariantsByMarketplace: () => ({
    tcgplayer: mocks.ignore.current,
    cardmarket: mocks.ignore.current,
    cardtrader: mocks.ignore.current,
    cardnexus: mocks.ignore.current,
  }),
}));
vi.mock("@/features/admin/lib/accept-undo", () => ({
  acceptFieldWithUndo: vi.fn(async () => true),
}));
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

function latest() {
  return useWorkspaceSelectionStore.getState().undoStack.at(-1);
}

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

let resetStore: () => void;

afterEach(() => {
  resetStore();
});

beforeEach(() => {
  resetIdCounter();
  resetStore = createStoreResetter(useWorkspaceSelectionStore);
  mocks.acceptField.current = mutation();
  mocks.checkAll.current = mutation();
  mocks.acceptPrintingFieldFn.mockClear();
  mocks.uncheckFn.mockClear();
  mocks.unmapFn.mockClear();
  mocks.unignoreFn.mockClear();
  vi.mocked(toast.success).mockClear();
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
          record: "Kai'Sa · OGN-001",
          model,
          listings: [LISTING],
          canCheck: true,
          canMap: true,
        }),
      { wrapper: wrapper(client) },
    );

    await mocks.registered.current?.primary?.run();
    expect(mocks.checkAll.current?.mutateAsync).toHaveBeenCalledWith({ extraIds: [candidate.id] });
    const entry = latest();
    expect(entry?.label).toBe("Discarded 1 suggestion on Kai'Sa · OGN-001");
    await entry?.undo();
    expect(mocks.uncheckFn).toHaveBeenCalledWith({ data: { id: candidate.id } });
  });

  it("Discard pushes an undo that unchecks the row", async () => {
    const { model, candidate } = setup();
    mocks.generic.current = {
      ...mutation(),
      mutate: vi.fn((_input: unknown, options?: { onSuccess?: () => void }) =>
        options?.onSuccess?.(),
      ),
    };
    const client = new QueryClient();
    const { result } = renderHook(
      () =>
        usePrintingRecordActions({
          printingId: "p1",
          record: "Kai'Sa · OGN-001",
          model,
          listings: [],
          canCheck: true,
          canMap: true,
        }),
      { wrapper: wrapper(client) },
    );

    result.current.discard(candidate.id);
    expect(toast.success).toHaveBeenCalledWith(
      "Discarded 1 suggestion on Kai'Sa · OGN-001",
      expect.anything(),
    );
    await latest()?.undo();
    expect(mocks.uncheckFn).toHaveBeenCalledWith({ data: { id: candidate.id } });
  });

  it("maps the listing with the number key and refreshes the queue once it settles", async () => {
    const { model } = setup();
    mocks.save.current = {
      ...mutation(),
      mutateAsync: vi.fn(async () => ({ skipped: [] }) as unknown as void),
    };
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    renderHook(
      () =>
        usePrintingRecordActions({
          printingId: "p1",
          record: "Kai'Sa · OGN-001",
          model,
          listings: [LISTING],
          canCheck: true,
          canMap: true,
        }),
      { wrapper: wrapper(client) },
    );

    await mocks.registered.current?.useSuggestion?.(2);
    expect(mocks.save.current?.mutateAsync).toHaveBeenCalledWith({
      mappings: [{ externalId: 7, finish: "normal", language: null, printingId: "p1" }],
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin", "workspace"] });
    expect(latest()?.label).toBe("Assigned TCGplayer #7 to Kai'Sa · OGN-001");
    await latest()?.undo();
    expect(mocks.unmapFn).toHaveBeenCalledWith({
      data: {
        marketplace: "tcgplayer",
        printingId: "p1",
        externalId: 7,
        finish: "normal",
        language: null,
      },
    });
  });

  it("pushes no entry for a mapping the server skipped or refused", async () => {
    const { model } = setup();
    mocks.save.current = {
      ...mutation(),
      mutateAsync: vi
        .fn()
        .mockResolvedValueOnce({ skipped: [{ externalId: 7, reason: "taken" }] })
        .mockRejectedValueOnce(new Error("offline")),
    };
    const client = new QueryClient();
    renderHook(
      () =>
        usePrintingRecordActions({
          printingId: "p1",
          record: "Kai'Sa · OGN-001",
          model,
          listings: [LISTING],
          canCheck: true,
          canMap: true,
        }),
      { wrapper: wrapper(client) },
    );

    await mocks.registered.current?.useSuggestion?.(2);
    await mocks.registered.current?.useSuggestion?.(2);
    expect(useWorkspaceSelectionStore.getState().undoStack).toEqual([]);
  });

  it("Use pushes an entry whose undo writes the previous value back", async () => {
    const { model } = setup();
    const client = new QueryClient();
    renderHook(
      () =>
        usePrintingRecordActions({
          printingId: "p1",
          record: "Kai'Sa · OGN-001",
          model,
          listings: [],
          canCheck: true,
          canMap: true,
        }),
      { wrapper: wrapper(client) },
    );

    await mocks.registered.current?.useSuggestion?.(1);
    const [options] = vi.mocked(acceptFieldWithUndo).mock.lastCall as unknown as [
      { onAccepted: (revert: unknown) => void },
    ];
    const { onAccepted } = options;
    const revert = { printingId: "p1", field: "size", value: "standard", source: "manual" };
    onAccepted(revert);

    expect(latest()?.label).toBe("Used Size from provider-a on Kai'Sa · OGN-001");
    await latest()?.undo();
    expect(mocks.acceptPrintingFieldFn).toHaveBeenCalledWith({ data: revert });
  });

  it("keeps the number key's promise pending until the write lands", async () => {
    const { model } = setup();
    let finish = () => {};
    mocks.acceptField.current = {
      ...mutation(),
      mutateAsync: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      ),
    };
    vi.mocked(acceptFieldWithUndo).mockImplementationOnce(async ({ accept, input }) => {
      await accept(input);
      return true;
    });
    const client = new QueryClient();
    renderHook(
      () =>
        usePrintingRecordActions({
          printingId: "p1",
          record: "Kai'Sa · OGN-001",
          model,
          listings: [],
          canCheck: true,
          canMap: true,
        }),
      { wrapper: wrapper(client) },
    );

    let settled = false;
    const run = (async () => {
      await mocks.registered.current?.useSuggestion?.(1);
      settled = true;
    })();
    await Promise.resolve();
    expect(settled).toBe(false);
    finish();
    await run;
    expect(settled).toBe(true);
  });

  it("hides listings from holders who cannot map and keeps Enter as plain Next", () => {
    const { model } = setup();
    const client = new QueryClient();
    const { result } = renderHook(
      () =>
        usePrintingRecordActions({
          printingId: "p1",
          record: "Kai'Sa · OGN-001",
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

  it("ignores a listing as one SKU and pushes an entry once it lands", async () => {
    const { model } = setup();
    const client = new QueryClient();
    const { result } = renderHook(
      () =>
        usePrintingRecordActions({
          printingId: "p1",
          record: "Kai'Sa · OGN-001",
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
    expect(useWorkspaceSelectionStore.getState().undoStack).toEqual([]);
    const [, ignoreOptions] = mocks.ignore.current!.mutate.mock.lastCall as [
      unknown,
      { onSuccess: () => void },
    ];
    ignoreOptions.onSuccess();
    expect(latest()?.label).toBe("Ignored TCGplayer #7 on Kai'Sa · OGN-001");
    await latest()?.undo();
    expect(mocks.unignoreFn).toHaveBeenCalledWith({
      data: {
        level: "variant",
        marketplace: "tcgplayer",
        externalId: 7,
        finish: "normal",
        language: null,
      },
    });
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
          record: "Kai'Sa · OGN-001",
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
    void result.current.applyChip(chip!);
    expect(vi.mocked(acceptFieldWithUndo).mock.lastCall?.[0].input).toEqual({
      printingId: "p1",
      field: "releasedAt",
      value: { releasedAt: "2026-11-01", releasePrecision: "month" },
      source: "provider",
    });
    expect(vi.mocked(acceptFieldWithUndo).mock.lastCall?.[0].previousValue).toEqual({
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
          record: "Kai'Sa · OGN-001",
          model,
          listings: [],
          canCheck: true,
          canMap: true,
        }),
      { wrapper: wrapper(client) },
    );

    void result.current.applyChip(result.current.chips[0]!);
    expect(vi.mocked(acceptFieldWithUndo).mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        accept: mocks.acceptField.current?.mutateAsync,
        input: { printingId: "p1", field: "size", value: "oversized", source: "provider" },
      }),
    );
  });
});
