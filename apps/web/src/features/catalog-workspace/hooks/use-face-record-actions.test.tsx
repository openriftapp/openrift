import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RecordActions } from "@/features/catalog-workspace/hooks/use-register-record-actions";
import { buildFaceSuggestions } from "@/features/catalog-workspace/lib/face-suggestion-rows";
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
  return {
    mutate: vi.fn((_input: unknown, options?: { onSuccess?: () => void }) =>
      options?.onSuccess?.(),
    ),
    mutateAsync: vi.fn(async () => {}),
    isPending: false,
  };
}

const mocks = vi.hoisted(() => ({
  acceptField: { current: null as ReturnType<typeof mutation> | null },
  checkCandidate: { current: null as ReturnType<typeof mutation> | null },
  checkAll: { current: null as ReturnType<typeof mutation> | null },
  setImage: { current: null as ReturnType<typeof mutation> | null },
  acceptSubmission: { current: null as ReturnType<typeof mutation> | null },
  scopes: [] as unknown[],
  registered: { current: null as RecordActions | null },
  toast: vi.fn(),
  acceptPrintingFieldFn: vi.fn((_input: unknown) => Promise.resolve()),
  uncheckFn: vi.fn((_input: unknown) => Promise.resolve()),
}));

vi.mock("@/features/admin/hooks/use-admin-card-mutations", () => ({
  acceptPrintingFieldFn: mocks.acceptPrintingFieldFn,
  uncheckCandidatePrintingFn: mocks.uncheckFn,
  useAcceptPrintingField: (scope: unknown) => {
    mocks.scopes.push(scope);
    return mocks.acceptField.current;
  },
  useCheckCandidatePrinting: () => mocks.checkCandidate.current,
  useCheckAllCandidatePrintings: () => mocks.checkAll.current,
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn() }) }));
vi.mock("@/features/admin/hooks/use-admin-image-mutations", () => ({
  useSetCandidatePrintingImage: () => mocks.setImage.current,
}));
vi.mock("@/features/admin/hooks/use-catalog-review", () => ({
  useAcceptSubmission: () => mocks.acceptSubmission.current,
}));
vi.mock("@/features/admin/hooks/use-distribution-channels", () => ({
  useDistributionChannels: () => ({ data: { distributionChannels: [] } }),
}));
vi.mock("@/features/admin/hooks/use-markers", () => ({
  useMarkers: () => ({ data: { markers: [] } }),
}));
vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({ labels: {} }),
  useLanguageLabels: () => ({}),
}));
vi.mock("@/features/admin/lib/accept-undo", () => ({ acceptFieldWithUndo: mocks.toast }));
vi.mock("@/features/catalog-workspace/hooks/use-register-record-actions", () => ({
  useRegisterRecordActions: (actions: RecordActions) => {
    mocks.registered.current = actions;
  },
}));

const { faceChips, useFaceRecordActions } = await import("./use-face-record-actions");

const CONTEXT = { costKeywords: [], setTotals: {} };

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

function latest() {
  return useWorkspaceSelectionStore.getState().undoStack.at(-1);
}

function setup(options: { contributor?: boolean } = {}) {
  const source = makeCandidateCard({
    provider: options.contributor === true ? "usersubmission" : "provider-a",
  });
  const printing = makeAdminPrinting({ id: "printing-1", faceId: "face-1", artist: "" });
  const candidate = makeCandidatePrinting({
    candidateCardId: source.id,
    printingId: "printing-1",
    artist: "Kudos Productions",
    imageUrl: "https://img.example/scan.png",
  });
  const detail = makeAdminCardDetail({
    sources: [source],
    printings: [printing],
    candidatePrintings: [candidate],
  });
  return { model: buildFaceSuggestions(detail, "face-1", CONTEXT), candidate, source };
}

let resetStore: () => void;

afterEach(() => {
  resetStore();
});

beforeEach(() => {
  resetIdCounter();
  resetStore = createStoreResetter(useWorkspaceSelectionStore);
  vi.mocked(toast.success).mockClear();
  mocks.acceptField.current = mutation();
  mocks.checkCandidate.current = mutation();
  mocks.checkAll.current = mutation();
  mocks.acceptPrintingFieldFn.mockClear();
  mocks.uncheckFn.mockClear();
  mocks.setImage.current = mutation();
  mocks.acceptSubmission.current = mutation();
  mocks.scopes.length = 0;
  mocks.registered.current = null;
  mocks.toast.mockReset();
});

describe("faceChips", () => {
  it("puts source images before field suggestions", () => {
    const { model } = setup();
    expect(faceChips(model).map((chip) => chip.kind)).toEqual(["image", "field"]);
  });
});

describe("useFaceRecordActions", () => {
  it("refreshes the workspace queue and records after a field is used", () => {
    const { model } = setup();
    renderHook(
      () =>
        useFaceRecordActions({
          cardSlug: "OGN-001",
          record: "Teemo, Scout",
          model,
          canCheck: true,
          enabled: true,
        }),
      { wrapper },
    );
    expect(mocks.scopes[0]).toContainEqual(["admin", "workspace"]);
  });

  it("registers Enter to check the remaining source rows", async () => {
    const { model, candidate } = setup();
    renderHook(
      () =>
        useFaceRecordActions({
          cardSlug: "OGN-001",
          record: "Teemo, Scout",
          model,
          canCheck: true,
          enabled: true,
        }),
      { wrapper },
    );

    const primary = mocks.registered.current?.primary;
    expect(primary?.label).toBe("Discard 1 & next");
    await primary?.run();
    expect(mocks.checkAll.current?.mutateAsync).toHaveBeenCalledWith({ extraIds: [candidate.id] });
  });

  it("leaves Enter as plain Next for holders who cannot check", () => {
    const { model } = setup();
    renderHook(
      () =>
        useFaceRecordActions({
          cardSlug: "OGN-001",
          record: "Teemo, Scout",
          model,
          canCheck: false,
          enabled: true,
        }),
      { wrapper },
    );
    expect(mocks.registered.current?.primary).toBeUndefined();
  });

  it("uses the nth suggestion: the scan first, then the field with its face", async () => {
    const { model, candidate } = setup();
    renderHook(
      () =>
        useFaceRecordActions({
          cardSlug: "OGN-001",
          record: "Teemo, Scout",
          model,
          canCheck: true,
          enabled: true,
        }),
      { wrapper },
    );

    await mocks.registered.current?.useSuggestion?.(1);
    expect(mocks.setImage.current?.mutateAsync).toHaveBeenCalledWith({
      candidatePrintingId: candidate.id,
      mode: "main",
    });

    await mocks.registered.current?.useSuggestion?.(2);
    expect(mocks.toast).toHaveBeenCalledOnce();
    expect(mocks.toast.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        accept: mocks.acceptField.current?.mutateAsync,
        input: {
          printingId: "printing-1",
          faceId: "face-1",
          field: "artist",
          value: "Kudos Productions",
          source: "provider",
        },
      }),
    );

    await mocks.registered.current?.useSuggestion?.(9);
    expect(mocks.toast).toHaveBeenCalledOnce();
  });

  it("Use pushes an entry once the accept lands, and its undo writes the old value back", async () => {
    const { model } = setup();
    renderHook(
      () =>
        useFaceRecordActions({
          cardSlug: "OGN-001",
          record: "Teemo, Scout",
          model,
          canCheck: true,
          enabled: true,
        }),
      { wrapper },
    );

    await mocks.registered.current?.useSuggestion?.(2);
    expect(useWorkspaceSelectionStore.getState().undoStack).toEqual([]);
    const [options] = mocks.toast.mock.lastCall as [{ onAccepted: (revert: unknown) => void }];
    const { onAccepted } = options;
    const revert = { printingId: "printing-1", field: "artist", value: "", source: "manual" };
    act(() => onAccepted(revert));

    expect(latest()?.label).toBe("Used Artist from provider-a on Teemo, Scout");
    expect(toast.success).toHaveBeenCalledWith(
      "Used Artist from provider-a on Teemo, Scout",
      expect.objectContaining({ action: expect.objectContaining({ label: "Undo (Z)" }) }),
    );
    await latest()?.undo();
    expect(mocks.acceptPrintingFieldFn).toHaveBeenCalledWith({ data: revert });
  });

  it("settles a contributor proposal through the submission", async () => {
    const { model, source, candidate } = setup({ contributor: true });
    const { result } = renderHook(
      () =>
        useFaceRecordActions({
          cardSlug: "OGN-001",
          record: "Teemo, Scout",
          model,
          canCheck: true,
          enabled: true,
        }),
      { wrapper },
    );

    await mocks.registered.current?.useSuggestion?.(1);
    expect(mocks.acceptSubmission.current?.mutateAsync).toHaveBeenCalledWith({
      candidateCardId: source.id,
      images: [{ candidatePrintingId: candidate.id, printingId: "printing-1", faceId: "face-1" }],
    });

    await mocks.registered.current?.useSuggestion?.(2);
    expect(mocks.acceptSubmission.current?.mutateAsync).toHaveBeenLastCalledWith({
      candidateCardId: source.id,
      printingFields: [
        {
          printingId: "printing-1",
          faceId: "face-1",
          field: "artist",
          value: "Kudos Productions",
          source: "provider",
        },
      ],
    });
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(result.current.enterCount).toBe(0);
  });

  it("Discard pushes an undo that unchecks the row, with an Undo toast", async () => {
    const { model, candidate } = setup();
    const { result } = renderHook(
      () =>
        useFaceRecordActions({
          cardSlug: "OGN-001",
          record: "Teemo, Scout",
          model,
          canCheck: true,
          enabled: true,
        }),
      { wrapper },
    );

    act(() => result.current.discard(candidate.id));

    expect(mocks.checkCandidate.current?.mutate).toHaveBeenCalledWith(
      candidate.id,
      expect.anything(),
    );
    expect(toast.success).toHaveBeenCalledWith(
      "Discarded 1 suggestion and 1 image on Teemo, Scout",
      expect.objectContaining({ action: expect.objectContaining({ label: "Undo (Z)" }) }),
    );
    expect(latest()?.undoneLabel).toBe("Undone: 1 suggestion and 1 image restored on Teemo, Scout");
    await latest()?.undo();
    expect(mocks.uncheckFn).toHaveBeenCalledWith({ data: { id: candidate.id } });
  });

  it("the toast Undo removes its own entry and runs once", async () => {
    const { model, candidate } = setup();
    const { result } = renderHook(
      () =>
        useFaceRecordActions({
          cardSlug: "OGN-001",
          record: "Teemo, Scout",
          model,
          canCheck: true,
          enabled: true,
        }),
      { wrapper },
    );
    act(() => result.current.discard(candidate.id));
    const [[, options]] = vi.mocked(toast.success).mock.calls as unknown as [
      [string, { action: { onClick: () => void } }],
    ];

    options.action.onClick();
    options.action.onClick();

    await vi.waitFor(() => expect(useWorkspaceSelectionStore.getState().undoStack).toEqual([]));
    expect(mocks.uncheckFn).toHaveBeenCalledOnce();
  });

  it("Enter pushes one undo that unchecks every discarded row", async () => {
    const { model, candidate } = setup();
    renderHook(
      () =>
        useFaceRecordActions({
          cardSlug: "OGN-001",
          record: "Teemo, Scout",
          model,
          canCheck: true,
          enabled: true,
        }),
      { wrapper },
    );

    await mocks.registered.current?.primary?.run();
    const entry = latest();
    expect(entry?.label).toBe("Discarded 1 suggestion and 1 image on Teemo, Scout");
    await entry?.undo();
    expect(mocks.uncheckFn).toHaveBeenCalledWith({ data: { id: candidate.id } });
  });

  it("disables Enter while a contributor proposal is unanswered", () => {
    const { model } = setup({ contributor: true });
    const { result } = renderHook(
      () =>
        useFaceRecordActions({
          cardSlug: "OGN-001",
          record: "Teemo, Scout",
          model,
          canCheck: true,
          enabled: true,
        }),
      { wrapper },
    );
    expect(result.current.contributorOpen).toBe(true);
    expect(mocks.registered.current?.primary?.disabled).toBe(true);
  });

  it("keeps Enter open when the contributor row proposes nothing on this face", () => {
    const { model: base } = setup({ contributor: true });
    const model = {
      ...base,
      suggestions: [],
      sourceImages: [],
      sources: base.sources.map((source) => ({ ...source, differences: 0 })),
    };
    const { result } = renderHook(
      () =>
        useFaceRecordActions({
          cardSlug: "OGN-001",
          record: "Teemo, Scout",
          model,
          canCheck: true,
          enabled: true,
        }),
      { wrapper },
    );
    expect(result.current.contributorOpen).toBe(false);
    expect(mocks.registered.current?.primary?.disabled).toBe(false);
  });

  it("offers nothing while disabled", () => {
    const { model } = setup();
    const { result } = renderHook(
      () =>
        useFaceRecordActions({
          cardSlug: "OGN-001",
          record: "Teemo, Scout",
          model,
          canCheck: true,
          enabled: false,
        }),
      { wrapper },
    );
    expect(result.current.chips).toEqual([]);
    expect(mocks.registered.current?.primary).toBeUndefined();
  });
});
