import { describe, expect, it } from "vitest";

import { deckEditorSearchSchema, isWorkbenchModeNavigation } from "./deck-editor-search";

describe("deckEditorSearchSchema", () => {
  it("keeps a valid mode and target", () => {
    const parsed = deckEditorSearchSchema.parse({ editor: "build", target: "main" });
    expect(parsed.editor).toBe("build");
    expect(parsed.target).toBe("main");
  });

  it("drops an unknown mode instead of failing", () => {
    expect(deckEditorSearchSchema.parse({ editor: "stage" }).editor).toBeUndefined();
  });

  it("passes any target string through for the page to validate", () => {
    expect(deckEditorSearchSchema.parse({ target: "nowhere" }).target).toBe("nowhere");
  });

  it("drops a non-string target", () => {
    expect(deckEditorSearchSchema.parse({ target: true }).target).toBeUndefined();
  });

  it("leaves both unset when absent", () => {
    const parsed = deckEditorSearchSchema.parse({});
    expect(parsed.editor).toBeUndefined();
    expect(parsed.target).toBeUndefined();
  });
});

describe("isWorkbenchModeNavigation", () => {
  const at = (pathname: string, search: Record<string, unknown>) => ({ pathname, search });

  it("accepts a switch of mode and target on the same deck", () => {
    expect(
      isWorkbenchModeNavigation(
        at("/decks/1", { editor: "deck" }),
        at("/decks/1", { editor: "build", target: "main" }),
      ),
    ).toBe(true);
  });

  it("rejects leaving the deck", () => {
    expect(isWorkbenchModeNavigation(at("/decks/1", {}), at("/decks", {}))).toBe(false);
  });

  it("rejects a change to any other search param", () => {
    expect(
      isWorkbenchModeNavigation(
        at("/decks/1", { editor: "deck" }),
        at("/decks/1", { editor: "build", search: "annie" }),
      ),
    ).toBe(false);
  });
});
