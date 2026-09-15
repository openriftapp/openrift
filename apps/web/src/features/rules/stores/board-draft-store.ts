import type { BoardDocument } from "@openrift/shared/board-state";
import { boardDocumentSchema } from "@openrift/shared/board-state";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface BoardDraft {
  title: string;
  answer: string;
  coreRulesVersion: string | null;
  tournamentRulesVersion: string | null;
  document: BoardDocument;
}

interface BoardDraftState {
  draft: BoardDraft | null;
  saveDraft: (draft: BoardDraft) => void;
  clearDraft: () => void;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function parseBoardDraft(value: unknown): BoardDraft | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const document = boardDocumentSchema.safeParse(raw.document);
  if (!document.success || typeof raw.title !== "string") {
    return null;
  }
  return {
    title: raw.title,
    answer: typeof raw.answer === "string" ? raw.answer : "",
    coreRulesVersion: stringOrNull(raw.coreRulesVersion),
    tournamentRulesVersion: stringOrNull(raw.tournamentRulesVersion),
    document: document.data,
  };
}

export const useBoardDraftStore = create<BoardDraftState>()(
  persist(
    (set) => ({
      draft: null,
      saveDraft: (draft) => set({ draft }),
      clearDraft: () => set({ draft: null }),
    }),
    {
      name: "openrift-board-state-draft",
      partialize: (state) => ({ draft: state.draft }),
      merge: (persisted, current) => {
        const raw = persisted as { draft?: unknown } | undefined;
        return { ...current, draft: parseBoardDraft(raw?.draft) };
      },
    },
  ),
);
