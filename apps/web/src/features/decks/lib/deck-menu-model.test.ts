import { describe, expect, it } from "vitest";

import type { DeckMenuSubject } from "./deck-menu-model";
import { deckMenuModel } from "./deck-menu-model";

const SERVER_ROW: DeckMenuSubject = {
  context: "row",
  server: true,
  cardCount: 40,
  archived: false,
  isVariant: false,
  isPrimary: false,
  hasOtherFormats: true,
};

describe("deckMenuModel", () => {
  it("gives a public deck the outputs and no Manage group", () => {
    const model = deckMenuModel({ ...SERVER_ROW, context: "public", server: false });

    expect(model.open).toEqual(["play", "compare"]);
    expect(model.share).toEqual(["shareLink", "saveImage"]);
    expect(model.copy).toEqual(["copyText", "copyCode", "copyTts"]);
    expect(model.print).toEqual(["printProxies", "printRegistration"]);
    expect(model.manage).toBeNull();
  });

  it("gives the viewer's own server deck every group in the same order", () => {
    const model = deckMenuModel(SERVER_ROW);

    expect(model.open).toEqual(["present", "play", "compare"]);
    expect(model.manage).toEqual({
      storedIn: true,
      edit: ["details", "cover", "changeFormat"],
      copies: ["duplicate", "newVariant", "variants"],
      organize: ["pin", "folders", "draft", "archive"],
      directDuplicate: false,
      unarchive: false,
    });
  });

  it("adds Import & replace only in the editor", () => {
    expect(deckMenuModel({ ...SERVER_ROW, context: "editor" }).manage?.edit).toContain(
      "importReplace",
    );
    expect(deckMenuModel(SERVER_ROW).manage?.edit).not.toContain("importReplace");
  });

  it("offers Make primary only on a variant that isn't primary yet", () => {
    expect(deckMenuModel({ ...SERVER_ROW, isVariant: true }).manage?.copies).toContain(
      "makePrimary",
    );
    expect(
      deckMenuModel({ ...SERVER_ROW, isVariant: true, isPrimary: true }).manage?.copies,
    ).not.toContain("makePrimary");
    expect(deckMenuModel(SERVER_ROW).manage?.copies).not.toContain("makePrimary");
  });

  it("drops Change format when the deck has no other format to move to", () => {
    expect(deckMenuModel({ ...SERVER_ROW, hasOtherFormats: false }).manage?.edit).toEqual([
      "details",
      "cover",
    ]);
  });

  it("puts Unarchive next to Delete on an archived deck", () => {
    expect(deckMenuModel({ ...SERVER_ROW, archived: true }).manage?.unarchive).toBe(true);
  });

  it("leaves the account-only entries off a browser-local deck", () => {
    const model = deckMenuModel({ ...SERVER_ROW, server: false });

    expect(model.open).toEqual(["play", "compare"]);
    expect(model.share).toEqual(["saveImage"]);
    expect(model.manage).toMatchObject({
      storedIn: false,
      edit: ["rename", "cover", "changeFormat"],
      copies: [],
      organize: [],
      directDuplicate: true,
      unarchive: false,
    });
  });

  it("disables every output of a deck with no cards and keeps the rest", () => {
    const model = deckMenuModel({ ...SERVER_ROW, cardCount: 0 });

    expect([...model.disabled].toSorted()).toEqual(
      [
        "copyCode",
        "copyText",
        "copyTts",
        "play",
        "present",
        "printProxies",
        "printRegistration",
        "saveImage",
      ].toSorted(),
    );
    expect(model.disabled.has("compare")).toBe(false);
    expect(model.disabled.has("shareLink")).toBe(false);
  });
});
