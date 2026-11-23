import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { acceptFieldWithUndo } from "@/features/admin/lib/accept-undo";
import type { PrintingSuggestionModel } from "@/features/catalog-workspace/lib/printing-suggestion-rows";
import { buildPrintingSuggestions } from "@/features/catalog-workspace/lib/printing-suggestion-rows";
import { resetWorkspaceWriteQueue } from "@/features/catalog-workspace/lib/workspace-write-queue";
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
  generic: { current: null as ReturnType<typeof mutation> | null },
  acceptPrintingFieldFn: vi.fn((_input: unknown) => Promise.resolve()),
}));

vi.mock("@/features/admin/hooks/use-admin-card-mutations", () => ({
  acceptPrintingFieldFn: mocks.acceptPrintingFieldFn,
  useAcceptPrintingField: () => mocks.acceptField.current,
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn() }) }));
vi.mock("@/features/admin/hooks/use-catalog-review", () => ({
  useAcceptSubmission: () => mocks.generic.current,
}));
vi.mock("@/features/admin/lib/accept-undo", () => ({
  acceptFieldWithUndo: vi.fn(async () => true),
  revertAcceptedField: (revert: unknown, write: (revert: unknown) => Promise<unknown>) =>
    write(revert),
}));

const { usePrintingFieldWrites } = await import("./use-printing-record-actions");

const CONTEXT = { costKeywords: [], setTotals: {} };

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
  return buildPrintingSuggestions([detail], "p1", CONTEXT);
}

function latest() {
  return useWorkspaceSelectionStore.getState().undoStack.at(-1);
}

function renderWrites(model: PrintingSuggestionModel) {
  const client = new QueryClient();
  return renderHook(
    () =>
      usePrintingFieldWrites({
        printingId: "p1",
        record: "Kai'Sa · OGN-001",
        printing: model.printing,
      }),
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    },
  );
}

let resetStore: () => void;

afterEach(() => {
  resetWorkspaceWriteQueue();
  resetStore();
});

beforeEach(() => {
  resetIdCounter();
  resetStore = createStoreResetter(useWorkspaceSelectionStore);
  mocks.acceptField.current = mutation();
  mocks.generic.current = mutation();
  mocks.acceptPrintingFieldFn.mockClear();
});

const { signal } = new AbortController();

describe("usePrintingFieldWrites", () => {
  it("pushes an entry whose undo writes the previous value back", async () => {
    const model = setup();
    const { result } = renderWrites(model);

    await act(() => result.current.applyField(signal, model.suggestions[0]!));
    const [options] = vi.mocked(acceptFieldWithUndo).mock.lastCall as unknown as [
      { onAccepted: (revert: unknown) => void },
    ];
    const revert = { printingId: "p1", field: "size", value: "standard", source: "manual" };
    options.onAccepted(revert);

    expect(latest()?.label).toBe("Used Size from provider-a on Kai'Sa · OGN-001");
    await latest()?.undo(signal);
    expect(mocks.acceptPrintingFieldFn).toHaveBeenCalledWith({ data: revert, signal });
  });

  it("keeps the write's promise pending until the write lands", async () => {
    const model = setup();
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
    const { result } = renderWrites(model);

    let settled = false;
    const run = (async () => {
      await result.current.applyField(signal, model.suggestions[0]!);
      settled = true;
    })();
    await Promise.resolve();
    expect(settled).toBe(false);
    finish();
    await run;
    expect(settled).toBe(true);
  });

  it("sends a source's release date together with its precision", async () => {
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
    const { result } = renderWrites(model);

    const suggestion = model.suggestions.find((entry) => entry.field === "releasedAt");
    await act(() => result.current.applyField(signal, suggestion!));
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

  it("sends any other field's proposed value as is", async () => {
    const model = setup();
    const { result } = renderWrites(model);

    await act(() => result.current.applyField(signal, model.suggestions[0]!));
    expect(vi.mocked(acceptFieldWithUndo).mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        accept: expect.any(Function),
        input: { printingId: "p1", field: "size", value: "oversized", source: "provider" },
      }),
    );
  });
});
