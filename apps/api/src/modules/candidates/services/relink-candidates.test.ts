import { describe, expect, it, vi } from "vitest";

import { relinkCandidatePrintings, reresolveEditedCandidateLink } from "./relink-candidates.js";

function makeRepos({
  unlinked = [] as unknown[],
  cardNorms = [] as unknown[],
  aliases = [] as unknown[],
  printingKeys = [] as unknown[],
  overrides = [] as unknown[],
} = {}) {
  const linkCandidatePrintings = vi.fn().mockResolvedValue(undefined);
  return {
    repos: {
      ingest: {
        allUnlinkedCandidatePrintings: vi.fn().mockResolvedValue(unlinked),
        allCardNorms: vi.fn().mockResolvedValue(cardNorms),
        allCardNameAliases: vi.fn().mockResolvedValue(aliases),
        allPrintingKeys: vi.fn().mockResolvedValue(printingKeys),
        allPrintingLinkOverrides: vi.fn().mockResolvedValue(overrides),
      },
      candidateCards: {
        linkCandidatePrintings,
      },
    } as never,
    linkCandidatePrintings,
  };
}

function makeUnlinked(overrides: Record<string, unknown> = {}) {
  return {
    id: "cp-1",
    shortCode: "OGN-001",
    finish: "normal",
    markerSlugs: [],
    language: "EN",
    externalId: "ext-1",
    cardName: "Fireball",
    ...overrides,
  };
}

const fireballKey = {
  id: "printing-uuid",
  cardId: "card-uuid",
  shortCode: "OGN-001",
  finish: "normal",
  markerSlugs: [],
  language: "EN",
};

describe("relinkCandidatePrintings", () => {
  it("returns zeros when nothing is unlinked", async () => {
    const { repos, linkCandidatePrintings } = makeRepos();
    expect(await relinkCandidatePrintings(repos)).toEqual({ examined: 0, linked: 0 });
    expect(linkCandidatePrintings).not.toHaveBeenCalled();
  });

  it("links a row whose composite key now matches an accepted printing", async () => {
    const { repos, linkCandidatePrintings } = makeRepos({
      unlinked: [makeUnlinked()],
      cardNorms: [{ id: "card-uuid", normName: "fireball" }],
      printingKeys: [fireballKey],
    });
    expect(await relinkCandidatePrintings(repos)).toEqual({ examined: 1, linked: 1 });
    expect(linkCandidatePrintings).toHaveBeenCalledWith(["cp-1"], "printing-uuid");
  });

  it("leaves a row unlinked when the matching printing belongs to another card", async () => {
    const { repos, linkCandidatePrintings } = makeRepos({
      unlinked: [makeUnlinked()],
      cardNorms: [{ id: "card-uuid", normName: "fireball" }],
      printingKeys: [{ ...fireballKey, cardId: "other-card-uuid" }],
    });
    expect(await relinkCandidatePrintings(repos)).toEqual({ examined: 1, linked: 0 });
    expect(linkCandidatePrintings).not.toHaveBeenCalled();
  });

  it("matches short codes case-insensitively and defaults language to EN", async () => {
    const { repos, linkCandidatePrintings } = makeRepos({
      unlinked: [makeUnlinked({ shortCode: "ogn-001", language: null })],
      cardNorms: [{ id: "card-uuid", normName: "fireball" }],
      printingKeys: [fireballKey],
    });
    expect(await relinkCandidatePrintings(repos)).toEqual({ examined: 1, linked: 1 });
    expect(linkCandidatePrintings).toHaveBeenCalledWith(["cp-1"], "printing-uuid");
  });

  it("resolves the card via alias when the direct norm does not match", async () => {
    const { repos } = makeRepos({
      unlinked: [makeUnlinked({ cardName: "Firbal" })],
      cardNorms: [{ id: "card-uuid", normName: "fireball" }],
      aliases: [{ cardId: "card-uuid", normName: "firbal" }],
      printingKeys: [fireballKey],
    });
    expect(await relinkCandidatePrintings(repos)).toEqual({ examined: 1, linked: 1 });
  });

  it("prefers a manual link override over key resolution", async () => {
    const { repos, linkCandidatePrintings } = makeRepos({
      unlinked: [makeUnlinked()],
      cardNorms: [{ id: "card-uuid", normName: "fireball" }],
      printingKeys: [fireballKey],
      overrides: [{ externalId: "ext-1", finish: "normal", printingId: "override-uuid" }],
    });
    await relinkCandidatePrintings(repos);
    expect(linkCandidatePrintings).toHaveBeenCalledWith(["cp-1"], "override-uuid");
  });

  it("applies an override even when the row has no finish", async () => {
    const { repos, linkCandidatePrintings } = makeRepos({
      unlinked: [makeUnlinked({ finish: null })],
      overrides: [{ externalId: "ext-1", finish: "", printingId: "override-uuid" }],
    });
    await relinkCandidatePrintings(repos);
    expect(linkCandidatePrintings).toHaveBeenCalledWith(["cp-1"], "override-uuid");
  });

  it("skips rows without finish, without a matching card, or with an empty norm", async () => {
    const { repos, linkCandidatePrintings } = makeRepos({
      unlinked: [
        makeUnlinked({ id: "cp-no-finish", finish: null }),
        makeUnlinked({ id: "cp-no-card", cardName: "Unknown Card" }),
        // A punctuation-only name normalizes to "" and must never resolve, even
        // when a card with an empty norm exists.
        makeUnlinked({ id: "cp-empty-norm", cardName: "!?!" }),
      ],
      cardNorms: [
        { id: "card-uuid", normName: "fireball" },
        { id: "empty-card-uuid", normName: "" },
      ],
      printingKeys: [fireballKey],
    });
    expect(await relinkCandidatePrintings(repos)).toEqual({ examined: 3, linked: 0 });
    expect(linkCandidatePrintings).not.toHaveBeenCalled();
  });

  it("bulk-links per target printing across rows", async () => {
    const { repos, linkCandidatePrintings } = makeRepos({
      unlinked: [
        makeUnlinked({ id: "cp-1" }),
        makeUnlinked({ id: "cp-2", externalId: "ext-2" }),
        makeUnlinked({ id: "cp-3", externalId: "ext-3", finish: "foil" }),
      ],
      cardNorms: [{ id: "card-uuid", normName: "fireball" }],
      printingKeys: [fireballKey, { ...fireballKey, id: "foil-uuid", finish: "foil" }],
    });
    expect(await relinkCandidatePrintings(repos)).toEqual({ examined: 3, linked: 3 });
    expect(linkCandidatePrintings).toHaveBeenCalledTimes(2);
    expect(linkCandidatePrintings).toHaveBeenCalledWith(["cp-1", "cp-2"], "printing-uuid");
    expect(linkCandidatePrintings).toHaveBeenCalledWith(["cp-3"], "foil-uuid");
  });

  it("sorts marker slugs before keying so order never blocks a match", async () => {
    const { repos, linkCandidatePrintings } = makeRepos({
      unlinked: [makeUnlinked({ markerSlugs: ["promo", "launch-exclusive"] })],
      cardNorms: [{ id: "card-uuid", normName: "fireball" }],
      printingKeys: [{ ...fireballKey, markerSlugs: ["launch-exclusive", "promo"] }],
    });
    expect(await relinkCandidatePrintings(repos)).toEqual({ examined: 1, linked: 1 });
    expect(linkCandidatePrintings).toHaveBeenCalledWith(["cp-1"], "printing-uuid");
  });
});

describe("reresolveEditedCandidateLink", () => {
  const foilKey = { ...fireballKey, id: "foil-uuid", finish: "foil" };
  const before = {
    shortCode: "OGN-001",
    finish: "normal",
    rarity: null,
    markerSlugs: [],
    language: "EN",
    size: null,
  };

  function editedRepos(row: Record<string, unknown>, overrides: unknown[] = []) {
    const linkCandidatePrintings = vi.fn().mockResolvedValue(undefined);
    const movePrintingLinkPin = vi.fn().mockResolvedValue(undefined);
    const repos = {
      ingest: {
        candidatePrintingForRelink: vi.fn().mockResolvedValue({
          ...makeUnlinked(),
          ...before,
          provider: "gallery",
          printingId: "printing-uuid",
          ...row,
        }),
        allCardNorms: vi.fn().mockResolvedValue([{ id: "card-uuid", normName: "fireball" }]),
        allCardNameAliases: vi.fn().mockResolvedValue([]),
        allPrintingKeys: vi.fn().mockResolvedValue([fireballKey, foilKey]),
        allPrintingLinkOverrides: vi.fn().mockResolvedValue(overrides),
        movePrintingLinkPin,
      },
      candidateCards: { linkCandidatePrintings },
    } as never;
    return { repos, linkCandidatePrintings, movePrintingLinkPin };
  }

  it("moves the link when an edit changes the finish", async () => {
    const { repos, linkCandidatePrintings } = editedRepos({ finish: "foil" });
    await reresolveEditedCandidateLink(repos, "cp-1", before);
    expect(linkCandidatePrintings).toHaveBeenCalledWith(["cp-1"], "foil-uuid");
  });

  it("unlinks when the edited code matches no printing", async () => {
    const { repos, linkCandidatePrintings } = editedRepos({ shortCode: "OGN-999" });
    await reresolveEditedCandidateLink(repos, "cp-1", before);
    expect(linkCandidatePrintings).toHaveBeenCalledWith(["cp-1"], null);
  });

  it("leaves the link alone when the edit did not touch the identity", async () => {
    const { repos, linkCandidatePrintings } = editedRepos({ shortCode: "ogn-001" });
    await reresolveEditedCandidateLink(repos, "cp-1", before);
    expect(linkCandidatePrintings).not.toHaveBeenCalled();
  });

  it("keeps a pinned link and moves its pin to the new finish", async () => {
    const { repos, linkCandidatePrintings, movePrintingLinkPin } = editedRepos({ finish: "foil" }, [
      { provider: "gallery", externalId: "ext-1", finish: "normal", printingId: "printing-uuid" },
    ]);
    await reresolveEditedCandidateLink(repos, "cp-1", before);
    expect(linkCandidatePrintings).not.toHaveBeenCalled();
    expect(movePrintingLinkPin).toHaveBeenCalledWith({
      provider: "gallery",
      externalId: "ext-1",
      fromFinish: "normal",
      toFinish: "foil",
    });
  });

  it("moves a pin when only the raw finish changes and the resolved finish stays", async () => {
    const { repos, movePrintingLinkPin } = editedRepos({ finish: null, rarity: "common" }, [
      { provider: "gallery", externalId: "ext-1", finish: "normal", printingId: "printing-uuid" },
    ]);
    await reresolveEditedCandidateLink(repos, "cp-1", { ...before, rarity: "common" });
    expect(movePrintingLinkPin).toHaveBeenCalledWith(
      expect.objectContaining({ fromFinish: "normal", toFinish: null }),
    );
  });

  it("leaves a contributor's claimed link alone", async () => {
    const { repos, linkCandidatePrintings } = editedRepos({
      finish: "foil",
      provider: "usersubmission",
    });
    await reresolveEditedCandidateLink(repos, "cp-1", before);
    expect(linkCandidatePrintings).not.toHaveBeenCalled();
  });
});
