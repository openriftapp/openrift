import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useDraftRevision } from "./use-draft-revision";

describe("useDraftRevision", () => {
  it("clears the dirty flag when the save succeeds with no later edit", () => {
    const { result } = renderHook(() => useDraftRevision());
    act(() => result.current.markEdited());

    const onSaved = result.current.beginSave();
    act(() => onSaved());

    expect(result.current.dirty).toBe(false);
  });

  it("stays dirty when text was typed while the save was in flight", () => {
    const { result } = renderHook(() => useDraftRevision());
    act(() => result.current.markEdited());

    const onSaved = result.current.beginSave();
    act(() => result.current.markEdited());
    act(() => onSaved());

    expect(result.current.dirty).toBe(true);
  });

  it("reset clears the flag regardless of pending saves", () => {
    const { result } = renderHook(() => useDraftRevision());
    act(() => result.current.markEdited());

    act(() => result.current.reset());

    expect(result.current.dirty).toBe(false);
  });
});
