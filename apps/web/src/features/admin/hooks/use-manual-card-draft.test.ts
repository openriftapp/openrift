import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useManualCardDraft } from "./use-manual-card-draft";

function filledDraft() {
  const { result } = renderHook(() => useManualCardDraft());
  act(() => {
    result.current.setName("  Jinx, Rebel ");
    result.current.setTypes(["unit"]);
    result.current.setDomains(["chaos"]);
  });
  return result;
}

describe("useManualCardDraft", () => {
  it("has no input until name, types and domains are set", () => {
    const { result } = renderHook(() => useManualCardDraft());
    expect(result.current.input).toBeUndefined();
    act(() => result.current.setName("Jinx, Rebel"));
    expect(result.current.input).toBeUndefined();
  });

  it("builds the create input with the slug made from the trimmed name", () => {
    const result = filledDraft();
    expect(result.current.slug).toBe("jinx-rebel");
    expect(result.current.input).toEqual({
      id: "jinx-rebel",
      name: "Jinx, Rebel",
      types: ["unit"],
      domains: ["chaos"],
    });
  });

  it("keeps an edited slug once the name changes", () => {
    const result = filledDraft();
    act(() => result.current.setSlug(" jinx-custom "));
    act(() => result.current.setName("Jinx, Loose Cannon"));
    expect(result.current.slugInput).toBe(" jinx-custom ");
    expect(result.current.input?.id).toBe("jinx-custom");
  });

  it("has no input for an emptied slug", () => {
    const result = filledDraft();
    act(() => result.current.setSlug("   "));
    expect(result.current.input).toBeUndefined();
  });

  it("adds stats, supertypes and tags only when set", () => {
    const result = filledDraft();
    act(() => {
      result.current.setStat("might", "3");
      result.current.setSuperTypes(["champion"]);
      result.current.setTags(["Piltover"]);
    });
    expect(result.current.input).toMatchObject({
      might: 3,
      superTypes: ["champion"],
      tags: ["Piltover"],
    });
    expect(result.current.input).not.toHaveProperty("energy");
  });

  it("has no input while a stat is not a whole number", () => {
    const result = filledDraft();
    act(() => result.current.setStat("energy", "1.5"));
    expect(result.current.input).toBeUndefined();
  });
});
