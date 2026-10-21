import type { WorkspaceOwner } from "@openrift/shared/contracts/admin/catalog-workspace";
import { create } from "zustand";
import { persist } from "zustand/middleware";

const OWNERS: readonly WorkspaceOwner[] = ["card", "face", "printing"];

type SkippedByOwner = Partial<Record<WorkspaceOwner, string[]>>;

interface WorkspaceSkipState {
  skipped: SkippedByOwner;
  skip: (owner: WorkspaceOwner, key: string) => void;
  prune: (owner: WorkspaceOwner, liveKeys: ReadonlySet<string>) => void;
  clearSkipped: (owner: WorkspaceOwner) => void;
}

function sanitizeSkipped(raw: unknown): SkippedByOwner {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const result: SkippedByOwner = {};
  for (const owner of OWNERS) {
    const keys = (raw as Record<string, unknown>)[owner];
    if (Array.isArray(keys)) {
      const valid = keys.filter((key): key is string => typeof key === "string");
      if (valid.length > 0) {
        result[owner] = [...new Set(valid)];
      }
    }
  }
  return result;
}

export const useWorkspaceSkipStore = create<WorkspaceSkipState>()(
  persist(
    (set, get) => ({
      skipped: {},

      skip: (owner, key) =>
        set((state) => ({
          skipped: {
            ...state.skipped,
            [owner]: [...(state.skipped[owner] ?? []).filter((entry) => entry !== key), key],
          },
        })),

      prune: (owner, liveKeys) => {
        const current = get().skipped[owner] ?? [];
        const kept = current.filter((key) => liveKeys.has(key));
        if (kept.length !== current.length) {
          set((state) => ({ skipped: { ...state.skipped, [owner]: kept } }));
        }
      },

      clearSkipped: (owner) => set((state) => ({ skipped: { ...state.skipped, [owner]: [] } })),
    }),
    {
      name: "catalog-workspace-skipped",
      partialize: (state) => ({ skipped: state.skipped }),
      merge: (persisted, current) => ({
        ...current,
        skipped: sanitizeSkipped((persisted as { skipped?: unknown } | null)?.skipped),
      }),
    },
  ),
);
