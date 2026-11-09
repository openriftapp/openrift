import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const undo = vi.fn();
const redo = vi.fn();

vi.mock("@/features/decks/hooks/use-deck-draft", () => ({
  useDeckDraftScope: () => "scope",
  useDeckDraftCollection: () => ({}),
}));
vi.mock("@/features/decks/hooks/use-deck-builder", () => ({
  allCards: () => [],
}));
vi.mock("@/features/decks/stores/deck-draft-store", () => ({
  applyDeckSnapshot: vi.fn(),
}));
vi.mock("@/features/decks/stores/deck-undo-store", () => ({
  useDeckUndoStore: { getState: () => ({ undo, redo }) },
}));

// oxlint-disable-next-line import/first -- must import after vi.mock
import { useDeckUndoShortcuts } from "./deck-undo-controls";

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  undo.mockReset();
  redo.mockReset();
});

afterEach(cleanup);

describe("useDeckUndoShortcuts", () => {
  it("undoes and redoes on the keyboard shortcuts", () => {
    renderHook(() => useDeckUndoShortcuts("deck-1"), { wrapper });
    fireEvent.keyDown(globalThis.window, { key: "z", ctrlKey: true });
    fireEvent.keyDown(globalThis.window, { key: "y", ctrlKey: true });
    expect(undo).toHaveBeenCalledWith("deck-1", []);
    expect(redo).toHaveBeenCalledWith("deck-1", []);
  });

  it("ignores the shortcuts while disabled", () => {
    renderHook(() => useDeckUndoShortcuts("deck-1", false), { wrapper });
    fireEvent.keyDown(globalThis.window, { key: "z", ctrlKey: true });
    fireEvent.keyDown(globalThis.window, { key: "z", ctrlKey: true, shiftKey: true });
    expect(undo).not.toHaveBeenCalled();
    expect(redo).not.toHaveBeenCalled();
  });
});
