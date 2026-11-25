import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CreationDraft } from "@/features/catalog-workspace/lib/creation-draft";

const mocks = vi.hoisted(() => ({
  isAdmin: true,
  accept: vi.fn((_input: unknown, _options?: unknown) => Promise.resolve({ printingId: "p-new" })),
  acceptMany: vi.fn((_input: unknown, _options?: unknown) =>
    Promise.resolve({ printingIds: ["p-a", "p-b"] }),
  ),
  update: vi.fn((_input: unknown, _options?: unknown) => Promise.resolve()),
  upload: vi.fn((_input: unknown, _options?: unknown) => Promise.resolve()),
  fromUrl: vi.fn((_input: unknown, _options?: unknown) => Promise.resolve()),
}));

vi.mock("@/features/admin/hooks/use-admin", () => ({
  useAdminAccess: () => ({ data: { isAdmin: mocks.isAdmin } }),
}));
vi.mock("@/hooks/use-session", () => ({
  useSession: () => ({ data: { user: { name: "Renata Glasc" } } }),
}));
vi.mock("@/features/admin/hooks/use-admin-card-mutations", () => ({
  useAcceptPrintingGroup: () => ({ mutateAsync: mocks.accept, isPending: false }),
  useAcceptPrintingGroups: () => ({ mutateAsync: mocks.acceptMany, isPending: false }),
}));
vi.mock("@/features/admin/hooks/use-printing-desk", () => ({
  useUpdateDeskPrinting: () => ({ mutateAsync: mocks.update, isPending: false }),
}));
vi.mock("@/features/admin/hooks/use-admin-image-mutations", () => ({
  useUploadPrintingImage: () => ({ mutateAsync: mocks.upload, isPending: false }),
  useAddImageFromUrl: () => ({ mutateAsync: mocks.fromUrl, isPending: false }),
}));
vi.mock("@/features/catalog-workspace/lib/creation-draft", () => ({
  toAcceptInput: (_draft: unknown, cardId?: string) => ({ cardId }),
  printingFollowUpFields: () => ({ releasedAt: "2026-11-01", comment: "Summoner Skirmish prize" }),
  plannedImageUploads: () => [
    { faceIndex: 0, face: "front", mode: "additional", image: { kind: "file", file: "scan.png" } },
  ],
}));

const { useAcceptPrintingDrafts } = await import("./use-printing-creation");

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

const draft = {} as CreationDraft;

beforeEach(() => {
  mocks.isAdmin = true;
  mocks.accept.mockClear();
  mocks.acceptMany.mockClear();
  mocks.update.mockClear();
  mocks.upload.mockClear();
});

describe("useAcceptPrintingDrafts", () => {
  it("saves the dates, the note and the extra images after the accept", async () => {
    const { result } = renderHook(() => useAcceptPrintingDrafts([]), { wrapper });
    const { signal } = new AbortController();

    let created: Awaited<ReturnType<typeof result.current.accept>> | undefined;
    await act(async () => {
      created = await result.current.accept(signal, draft, "card-1");
    });

    expect(created).toEqual({ printingId: "p-new", failure: null });
    expect(mocks.accept).toHaveBeenCalledWith({ cardId: "card-1" }, { signal });
    expect(mocks.update).toHaveBeenCalledWith(
      { printingId: "p-new", releasedAt: "2026-11-01", comment: "Summoner Skirmish prize" },
      { signal },
    );
    expect(mocks.upload).toHaveBeenCalledWith(
      {
        printingId: "p-new",
        file: "scan.png",
        mode: "additional",
        face: "front",
        credit: undefined,
      },
      { signal },
    );
  });

  it("names what did not save once the printing exists", async () => {
    mocks.update.mockRejectedValueOnce(new Error("Conflict"));
    const { result } = renderHook(() => useAcceptPrintingDrafts([]), { wrapper });

    let created: Awaited<ReturnType<typeof result.current.accept>> | undefined;
    await act(async () => {
      created = await result.current.accept(new AbortController().signal, draft);
    });

    expect(created?.printingId).toBe("p-new");
    expect(created?.failure).toMatch(
      /^The printing was created, but the dates and note did not save/u,
    );
  });

  it("creates every draft in one request, then saves each one's follow-ups", async () => {
    const { result } = renderHook(() => useAcceptPrintingDrafts([]), { wrapper });
    const { signal } = new AbortController();

    let outcome: Awaited<ReturnType<typeof result.current.acceptAll>> | undefined;
    await act(async () => {
      outcome = await result.current.acceptAll(
        signal,
        [
          { label: "OGN-001", draft },
          { label: "OGN-002", draft },
        ],
        "card-1",
      );
    });

    expect(outcome).toEqual({ notCreated: [], partial: [] });
    expect(mocks.accept).not.toHaveBeenCalled();
    expect(mocks.acceptMany).toHaveBeenCalledTimes(1);
    expect(mocks.acceptMany).toHaveBeenCalledWith(
      { cardId: "card-1", groups: [{}, {}] },
      { signal },
    );
    expect(
      mocks.update.mock.calls.map(([input]) => (input as { printingId: string }).printingId),
    ).toEqual(["p-a", "p-b"]);
  });

  it("names every draft as not created when the one request fails", async () => {
    mocks.acceptMany.mockRejectedValueOnce(new Error("Conflict"));
    const { result } = renderHook(() => useAcceptPrintingDrafts([]), { wrapper });

    let outcome: Awaited<ReturnType<typeof result.current.acceptAll>> | undefined;
    await act(async () => {
      outcome = await result.current.acceptAll(
        new AbortController().signal,
        [
          { label: "OGN-001", draft },
          { label: "OGN-002", draft },
        ],
        "card-1",
      );
    });

    expect(outcome?.notCreated).toEqual(["OGN-001 (Conflict)", "OGN-002 (Conflict)"]);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
