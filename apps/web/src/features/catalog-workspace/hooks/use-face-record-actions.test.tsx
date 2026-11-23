import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FaceChip } from "@/features/catalog-workspace/hooks/use-face-record-actions";
import type { FaceSuggestionModel } from "@/features/catalog-workspace/lib/face-suggestion-rows";
import { buildFaceSuggestions } from "@/features/catalog-workspace/lib/face-suggestion-rows";
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
  setImage: { current: null as ReturnType<typeof mutation> | null },
  acceptSubmission: { current: null as ReturnType<typeof mutation> | null },
  scopes: [] as unknown[],
  toast: vi.fn(),
  acceptPrintingFieldFn: vi.fn((_input: unknown) => Promise.resolve()),
}));

vi.mock("@/features/admin/hooks/use-admin-card-mutations", () => ({
  acceptPrintingFieldFn: mocks.acceptPrintingFieldFn,
  useAcceptPrintingField: (scope: unknown) => {
    mocks.scopes.push(scope);
    return mocks.acceptField.current;
  },
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
vi.mock("@/features/admin/lib/accept-undo", () => ({
  acceptFieldWithUndo: mocks.toast,
  revertAcceptedField: (revert: unknown, write: (revert: unknown) => Promise<unknown>) =>
    write(revert),
}));

const { useFaceSuggestionWrites } = await import("./use-face-record-actions");

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
  resetWorkspaceWriteQueue();
  resetStore();
});

beforeEach(() => {
  resetIdCounter();
  resetStore = createStoreResetter(useWorkspaceSelectionStore);
  vi.mocked(toast.success).mockClear();
  mocks.acceptField.current = mutation();
  mocks.acceptPrintingFieldFn.mockClear();
  mocks.setImage.current = mutation();
  mocks.acceptSubmission.current = mutation();
  mocks.scopes.length = 0;
  mocks.toast.mockReset();
});

const { signal } = new AbortController();

function chipsOf(model: FaceSuggestionModel): FaceChip[] {
  return [
    ...model.sourceImages.map((image): FaceChip => ({
      kind: "image",
      key: `image:${image.candidate.id}`,
      image,
    })),
    ...model.suggestions.map((suggestion): FaceChip => ({
      kind: "field",
      key: suggestion.key,
      suggestion,
    })),
  ];
}

function renderWrites(model: FaceSuggestionModel) {
  return renderHook(
    () =>
      useFaceSuggestionWrites({ cardSlug: "OGN-001", record: "Teemo, Scout", face: model.face }),
    { wrapper },
  );
}

describe("useFaceSuggestionWrites", () => {
  it("refreshes the workspace queue and records after a field is used", () => {
    renderWrites(setup().model);
    expect(mocks.scopes[0]).toContainEqual(["admin", "workspace"]);
  });

  it("uses a scan as the main image and a field with its face", async () => {
    const { model, candidate } = setup();
    const { result } = renderWrites(model);
    const [image, field] = chipsOf(model);

    await result.current.applyChip(signal, image!);
    expect(mocks.setImage.current?.mutateAsync).toHaveBeenCalledWith(
      { candidatePrintingId: candidate.id, mode: "main" },
      { signal: expect.any(AbortSignal) },
    );

    await result.current.applyChip(signal, field!);
    expect(mocks.toast).toHaveBeenCalledOnce();
    expect(mocks.toast.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        accept: expect.any(Function),
        input: {
          printingId: "printing-1",
          faceId: "face-1",
          field: "artist",
          value: "Kudos Productions",
          source: "provider",
        },
      }),
    );
  });

  it("pushes an entry once the accept lands, and its undo writes the old value back", async () => {
    const { model } = setup();
    const { result } = renderWrites(model);

    await result.current.applyChip(signal, chipsOf(model)[1]!);
    expect(useWorkspaceSelectionStore.getState().undoStack).toEqual([]);
    const [options] = mocks.toast.mock.lastCall as [{ onAccepted: (revert: unknown) => void }];
    const revert = { printingId: "printing-1", field: "artist", value: "", source: "manual" };
    act(() => options.onAccepted(revert));

    expect(latest()?.label).toBe("Used Artist from provider-a on Teemo, Scout");
    expect(toast.success).toHaveBeenCalledWith(
      "Used Artist from provider-a on Teemo, Scout",
      expect.objectContaining({ action: expect.objectContaining({ label: "Undo (Z)" }) }),
    );
    await latest()?.undo(signal);
    expect(mocks.acceptPrintingFieldFn).toHaveBeenCalledWith({ data: revert, signal });
  });

  it("settles a contributor proposal through the submission", async () => {
    const { model, source, candidate } = setup({ contributor: true });
    const { result } = renderWrites(model);
    const [image, field] = chipsOf(model);

    await result.current.applyChip(signal, image!);
    expect(mocks.acceptSubmission.current?.mutateAsync).toHaveBeenCalledWith(
      {
        candidateCardId: source.id,
        images: [{ candidatePrintingId: candidate.id, printingId: "printing-1", faceId: "face-1" }],
      },
      { signal: expect.any(AbortSignal) },
    );

    await result.current.applyChip(signal, field!);
    expect(mocks.acceptSubmission.current?.mutateAsync).toHaveBeenLastCalledWith(
      {
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
      },
      { signal },
    );
    expect(mocks.toast).not.toHaveBeenCalled();
  });
});
