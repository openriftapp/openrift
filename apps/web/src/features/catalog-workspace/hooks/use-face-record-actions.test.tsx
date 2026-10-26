import { act, renderHook } from "@testing-library/react";
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
  uncheck: { current: null as ReturnType<typeof mutation> | null },
  setImage: { current: null as ReturnType<typeof mutation> | null },
  acceptSubmission: { current: null as ReturnType<typeof mutation> | null },
  rejectSubmission: { current: null as ReturnType<typeof mutation> | null },
  scopes: [] as unknown[],
  registered: { current: null as RecordActions | null },
  toast: vi.fn(),
}));

vi.mock("@/features/admin/hooks/use-admin-card-mutations", () => ({
  useAcceptPrintingField: (scope: unknown) => {
    mocks.scopes.push(scope);
    return mocks.acceptField.current;
  },
  useCheckCandidatePrinting: () => mocks.checkCandidate.current,
  useCheckAllCandidatePrintings: () => mocks.checkAll.current,
  useUncheckCandidatePrinting: () => mocks.uncheck.current,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
vi.mock("@/features/admin/hooks/use-admin-image-mutations", () => ({
  useSetCandidatePrintingImage: () => mocks.setImage.current,
}));
vi.mock("@/features/admin/hooks/use-catalog-review", () => ({
  useAcceptSubmission: () => mocks.acceptSubmission.current,
  useRejectSubmission: () => mocks.rejectSubmission.current,
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
vi.mock("@/features/admin/lib/accept-undo", () => ({ toastFieldAccepted: mocks.toast }));
vi.mock("@/features/catalog-workspace/hooks/use-register-record-actions", () => ({
  useRegisterRecordActions: (actions: RecordActions) => {
    mocks.registered.current = actions;
  },
}));

const { faceChips, useFaceRecordActions } = await import("./use-face-record-actions");

const CONTEXT = { costKeywords: [], setTotals: {} };

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
  mocks.uncheck.current = mutation();
  mocks.setImage.current = mutation();
  mocks.acceptSubmission.current = mutation();
  mocks.rejectSubmission.current = mutation();
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
    renderHook(() =>
      useFaceRecordActions({ cardSlug: "OGN-001", model, canCheck: true, enabled: true }),
    );
    expect(mocks.scopes[0]).toContainEqual(["admin", "workspace"]);
  });

  it("registers Enter to check the remaining source rows", async () => {
    const { model, candidate } = setup();
    renderHook(() =>
      useFaceRecordActions({ cardSlug: "OGN-001", model, canCheck: true, enabled: true }),
    );

    const primary = mocks.registered.current?.primary;
    expect(primary?.label).toBe("Discard 1 & next");
    await primary?.run();
    expect(mocks.checkAll.current?.mutateAsync).toHaveBeenCalledWith({ extraIds: [candidate.id] });
  });

  it("leaves Enter as plain Next for holders who cannot check", () => {
    const { model } = setup();
    renderHook(() =>
      useFaceRecordActions({ cardSlug: "OGN-001", model, canCheck: false, enabled: true }),
    );
    expect(mocks.registered.current?.primary).toBeUndefined();
  });

  it("uses the nth suggestion: the scan first, then the field with its face", () => {
    const { model, candidate } = setup();
    renderHook(() =>
      useFaceRecordActions({ cardSlug: "OGN-001", model, canCheck: true, enabled: true }),
    );

    mocks.registered.current?.useSuggestion?.(1);
    expect(mocks.setImage.current?.mutate).toHaveBeenCalledWith({
      candidatePrintingId: candidate.id,
      mode: "main",
    });

    mocks.registered.current?.useSuggestion?.(2);
    expect(mocks.acceptField.current?.mutate).toHaveBeenCalledWith({
      printingId: "printing-1",
      faceId: "face-1",
      field: "artist",
      value: "Kudos Productions",
      source: "provider",
    });
    expect(mocks.toast).toHaveBeenCalledOnce();

    mocks.registered.current?.useSuggestion?.(9);
    expect(mocks.acceptField.current?.mutate).toHaveBeenCalledOnce();
  });

  it("settles a contributor proposal through the submission", () => {
    const { model, source, candidate } = setup({ contributor: true });
    const { result } = renderHook(() =>
      useFaceRecordActions({ cardSlug: "OGN-001", model, canCheck: true, enabled: true }),
    );

    mocks.registered.current?.useSuggestion?.(1);
    expect(mocks.acceptSubmission.current?.mutate).toHaveBeenCalledWith({
      candidateCardId: source.id,
      images: [{ candidatePrintingId: candidate.id, printingId: "printing-1", faceId: "face-1" }],
    });

    mocks.registered.current?.useSuggestion?.(2);
    expect(mocks.acceptSubmission.current?.mutate).toHaveBeenLastCalledWith({
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
    expect(mocks.acceptField.current?.mutate).not.toHaveBeenCalled();
    expect(result.current.enterCount).toBe(0);

    result.current.reject(source.id);
    expect(mocks.rejectSubmission.current?.mutate).toHaveBeenCalledWith({
      candidateCardId: source.id,
      note: null,
    });
  });

  it("Discard pushes an undo that unchecks the row, with an Undo toast", async () => {
    const { model, candidate } = setup();
    const { result } = renderHook(() =>
      useFaceRecordActions({ cardSlug: "OGN-001", model, canCheck: true, enabled: true }),
    );

    act(() => result.current.discard(candidate.id));

    expect(mocks.checkCandidate.current?.mutate).toHaveBeenCalledWith(
      candidate.id,
      expect.anything(),
    );
    expect(toast.success).toHaveBeenCalledWith(
      "Discarded 2 suggestions from provider-a",
      expect.objectContaining({ action: expect.objectContaining({ label: "Undo (Z)" }) }),
    );
    const entry = useWorkspaceSelectionStore.getState().popUndo();
    await entry?.undo();
    expect(mocks.uncheck.current?.mutateAsync).toHaveBeenCalledWith(candidate.id);
  });

  it("the toast Undo removes its own entry and runs once", async () => {
    const { model, candidate } = setup();
    const { result } = renderHook(() =>
      useFaceRecordActions({ cardSlug: "OGN-001", model, canCheck: true, enabled: true }),
    );
    act(() => result.current.discard(candidate.id));
    const [[, options]] = vi.mocked(toast.success).mock.calls as unknown as [
      [string, { action: { onClick: () => void } }],
    ];

    options.action.onClick();
    options.action.onClick();
    await Promise.resolve();

    expect(useWorkspaceSelectionStore.getState().undoStack).toEqual([]);
    expect(mocks.uncheck.current?.mutateAsync).toHaveBeenCalledOnce();
  });

  it("Enter pushes one undo that unchecks every discarded row", async () => {
    const { model, candidate } = setup();
    renderHook(() =>
      useFaceRecordActions({ cardSlug: "OGN-001", model, canCheck: true, enabled: true }),
    );

    await mocks.registered.current?.primary?.run();
    const entry = useWorkspaceSelectionStore.getState().popUndo();
    expect(entry?.label).toBe("Discarded 2 suggestions from provider-a");
    await entry?.undo();
    expect(mocks.uncheck.current?.mutateAsync).toHaveBeenCalledWith(candidate.id);
  });

  it("disables Enter while a contributor proposal is unanswered", () => {
    const { model } = setup({ contributor: true });
    const { result } = renderHook(() =>
      useFaceRecordActions({ cardSlug: "OGN-001", model, canCheck: true, enabled: true }),
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
    const { result } = renderHook(() =>
      useFaceRecordActions({ cardSlug: "OGN-001", model, canCheck: true, enabled: true }),
    );
    expect(result.current.contributorOpen).toBe(false);
    expect(mocks.registered.current?.primary?.disabled).toBe(false);
  });

  it("offers nothing while disabled", () => {
    const { model } = setup();
    const { result } = renderHook(() =>
      useFaceRecordActions({ cardSlug: "OGN-001", model, canCheck: true, enabled: false }),
    );
    expect(result.current.chips).toEqual([]);
    expect(mocks.registered.current?.primary).toBeUndefined();
  });
});
