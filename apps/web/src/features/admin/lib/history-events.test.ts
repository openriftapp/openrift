import { beforeEach, describe, expect, it } from "vitest";

import { makeAuditEvent, resetIdCounter } from "@/test/factories";

import {
  filterHistoryEvents,
  historyKind,
  historySentence,
  historyTarget,
  submissionOutcome,
} from "./history-events";

beforeEach(() => {
  resetIdCounter();
});

describe("historyKind", () => {
  it("sorts an action into submissions, sources or edits", () => {
    expect(historyKind("card-submission.accept")).toBe("submissions");
    expect(historyKind("candidate-printing.link")).toBe("sources");
    expect(historyKind("candidates.upload")).toBe("sources");
    expect(historyKind("provider.delete-candidates")).toBe("sources");
    expect(historyKind("ban.add")).toBe("edits");
  });
});

describe("historySentence", () => {
  it("names the fields an accept-field event changed", () => {
    const event = makeAuditEvent({
      action: "card.accept-field",
      oldValues: { mightBonus: 1 },
      newValues: { mightBonus: 2 },
    });
    expect(historySentence(event)).toBe("Changed Might bonus");
  });

  it("names the printing an event was about by its full printing id", () => {
    const event = makeAuditEvent({
      action: "printing.accept",
      entityType: "printing",
      entityId: "p-1",
      entityLabel: "UNL-131",
    });
    expect(historySentence(event, { printingLabels: { "p-1": "EN:UNL-131::normal" } })).toBe(
      "Added a printing: EN:UNL-131::normal",
    );
  });

  it("falls back to the short code when the printing is gone", () => {
    const event = makeAuditEvent({
      action: "printing.delete",
      entityType: "printing",
      entityId: "p-1",
      entityLabel: "UNL-131",
    });
    expect(historySentence(event, { printingLabels: {} })).toBe("Deleted a printing: UNL-131");
  });

  it("names the printing a field change landed on", () => {
    const event = makeAuditEvent({
      action: "printing.accept-field",
      entityType: "printing",
      entityId: "p-1",
      entityLabel: "UNL-131",
      oldValues: null,
      newValues: { artist: "Zoya" },
    });
    expect(historySentence(event, { printingLabels: { "p-1": "EN:UNL-131::normal" } })).toBe(
      "Changed Artist on EN:UNL-131::normal",
    );
  });

  it("lists what an accepted submission applied", () => {
    const event = makeAuditEvent({
      action: "card-submission.accept",
      entityType: "card",
      oldValues: null,
      newValues: {
        status: "accepted",
        applied: 4,
        cardFields: ["energy", "might"],
        printingFields: ["p-1:artist", "p-1:flavorText"],
        createdPrintingIds: ["p-2"],
        images: 1,
        skipped: [],
      },
    });
    expect(
      historySentence(event, {
        printingLabels: { "p-1": "EN:UNL-131::normal", "p-2": "EN:UNL-132::foil" },
      }),
    ).toBe(
      "Accepted a contributor submission (Energy, Might; Artist, Flavor text on EN:UNL-131::normal; new printing EN:UNL-132::foil; 1 image)",
    );
  });

  it("counts what a submission skipped when nothing else landed", () => {
    const event = makeAuditEvent({
      action: "card-submission.accept",
      entityType: "card",
      oldValues: null,
      newValues: { status: "not_applied", applied: 0, skipped: [{ reason: "exists" }] },
    });
    expect(historySentence(event)).toBe("Accepted a contributor submission (1 skipped)");
  });

  it("names the printings a trusted-source accept created", () => {
    const event = makeAuditEvent({
      action: "printing.accept-favorites",
      entityType: "printing",
      entityId: null,
      entityLabel: "fury-rune",
      oldValues: null,
      newValues: { printingsCreated: 2, skipped: 1, createdPrintingIds: ["p-1", "p-2"] },
    });
    expect(
      historySentence(event, {
        printingLabels: { "p-1": "EN:UNL-131::normal", "p-2": "EN:UNL-132::foil" },
      }),
    ).toBe("Added EN:UNL-131::normal, EN:UNL-132::foil from trusted sources (1 skipped)");
  });

  it("counts the printings a trusted-source accept created when their ids are gone", () => {
    const event = makeAuditEvent({
      action: "printing.accept-favorites",
      entityType: "printing",
      entityId: null,
      entityLabel: "fury-rune",
      oldValues: null,
      newValues: { printingsCreated: 3, skipped: 0 },
    });
    expect(historySentence(event)).toBe("Added 3 printings from trusted sources");
  });

  it("names the printing an image landed on, and where it went", () => {
    const event = makeAuditEvent({
      action: "image.upload",
      entityType: "image",
      entityLabel: null,
      oldValues: null,
      newValues: { mode: "main", printingId: "p-1" },
    });
    expect(historySentence(event, { printingLabels: { "p-1": "UNL-131" } })).toBe(
      "Uploaded an image as the main art on UNL-131",
    );
  });

  it("counts the rows a link moved and names their printing", () => {
    const event = makeAuditEvent({
      action: "candidate-printing.link",
      entityType: "candidate-printing",
      entityLabel: null,
      oldValues: null,
      newValues: { printingId: "p-1", candidatePrintingIds: ["cp-1", "cp-2"] },
    });
    expect(historySentence(event, { printingLabels: { "p-1": "UNL-131" } })).toBe(
      "Linked 2 incoming rows to UNL-131",
    );
  });

  it("names the source and row an ignore was about", () => {
    const event = makeAuditEvent({
      action: "candidate-printing.ignore",
      entityType: "candidate-printing",
      entityLabel: null,
      oldValues: null,
      newValues: { provider: "rb-tcg-arena", externalId: "ARC-003" },
    });
    expect(historySentence(event)).toBe("Ignored rb-tcg-arena's ARC-003 for this card");
  });

  it("summarises what an upload brought in", () => {
    const event = makeAuditEvent({
      action: "candidates.upload",
      entityType: "upload",
      entityLabel: "tacter",
      oldValues: null,
      newValues: { newCards: 0, newPrintings: 3, updates: 1, unchanged: 670, errors: 0 },
    });
    expect(historySentence(event)).toBe(
      "Uploaded fresh data from tacter (3 new printings, 1 card updates)",
    );
  });

  it("leaves a bulk event's card label off", () => {
    const event = makeAuditEvent({
      action: "printing.accept-favorites",
      entityType: "printing",
      entityLabel: "fury-rune",
      cardSlug: "fury-rune",
    });
    expect(historySentence(event)).toBe("Added printings from trusted sources");
  });

  it("leaves a card-level label off, since the page is that card", () => {
    const event = makeAuditEvent({
      action: "card.create",
      entityType: "card",
      entityLabel: "Fury Rune",
    });
    expect(historySentence(event)).toBe("Created the card");
  });

  it("spells a rename out", () => {
    const event = makeAuditEvent({
      action: "card.rename",
      oldValues: { slug: "souls-reflection" },
      newValues: { slug: "soul-s-reflection" },
    });
    expect(historySentence(event)).toBe(
      "Changed the card ID from souls-reflection to soul-s-reflection",
    );
  });

  it("lists the fields an edit moved", () => {
    const event = makeAuditEvent({
      action: "printing.update",
      entityType: "printing",
      entityLabel: "UNL-131",
      oldValues: { artist: "Old" },
      newValues: { artist: "New" },
    });
    expect(historySentence(event)).toBe("Edited a printing: UNL-131 (Artist)");
  });

  it("marks a printing field change as such", () => {
    const event = makeAuditEvent({
      action: "printing.accept-field",
      oldValues: null,
      newValues: { artist: "Zoya" },
    });
    expect(historySentence(event)).toBe("Changed Artist on a printing");
  });

  it("uses a plain sentence for a known action", () => {
    expect(historySentence(makeAuditEvent({ action: "ban.add" }))).toBe("Added a ban");
  });

  it("stays generic when the event names no field", () => {
    const event = makeAuditEvent({
      action: "card.accept-field",
      oldValues: null,
      newValues: null,
    });
    expect(historySentence(event)).toBe("Changed a field");
  });

  it("falls back to the action itself when it is unknown", () => {
    expect(historySentence(makeAuditEvent({ action: "meta-catalog.accept" }))).toBe(
      "meta-catalog.accept",
    );
  });
});

describe("historyTarget", () => {
  it("points at the printing an event names", () => {
    expect(
      historyTarget(
        makeAuditEvent({ action: "printing.update", entityType: "printing", entityId: "p-1" }),
      ),
    ).toEqual({ kind: "printing", printingId: "p-1" });
  });

  it("points a ban at the bans section and an upload at the sources page", () => {
    expect(historyTarget(makeAuditEvent({ action: "ban.add", entityType: "ban" }))).toEqual({
      kind: "bans",
    });
    expect(
      historyTarget(makeAuditEvent({ action: "candidates.upload", entityType: "upload" })),
    ).toEqual({ kind: "sources" });
  });

  it("has nowhere to send an event about the card itself", () => {
    expect(historyTarget(makeAuditEvent({ action: "card.create", entityType: "card" }))).toBeNull();
  });
});

describe("submissionOutcome", () => {
  it("reads the outcome an accept recorded", () => {
    expect(
      submissionOutcome(
        makeAuditEvent({ action: "card-submission.accept", newValues: { status: "accepted" } }),
      ),
    ).toBe("accepted");
    expect(
      submissionOutcome(
        makeAuditEvent({ action: "card-submission.accept", newValues: { status: "not_applied" } }),
      ),
    ).toBe("not_applied");
  });

  it("reports a rejection and nothing for other actions", () => {
    expect(submissionOutcome(makeAuditEvent({ action: "card-submission.reject" }))).toBe(
      "rejected",
    );
    expect(submissionOutcome(makeAuditEvent({ action: "ban.add" }))).toBeNull();
  });
});

describe("filterHistoryEvents", () => {
  const card = { slug: "OGN-001", name: "Jinx" };
  const events = [
    makeAuditEvent({ action: "ban.add", cardSlug: "OGN-001" }),
    makeAuditEvent({ action: "card-submission.accept", cardSlug: "OGN-001" }),
    makeAuditEvent({ action: "card-submission.reject", cardSlug: null, entityLabel: "Jinx" }),
    makeAuditEvent({ action: "candidates.upload", cardSlug: "OGN-001" }),
    makeAuditEvent({ action: "candidate-card.ignore", cardSlug: null, entityLabel: "Jinx" }),
    makeAuditEvent({ action: "printing.create", cardSlug: "OGN-002" }),
  ];

  it("drops events belonging to another card", () => {
    expect(filterHistoryEvents(events, card, "all").map((event) => event.action)).toEqual([
      "ban.add",
      "card-submission.accept",
      "card-submission.reject",
      "candidates.upload",
    ]);
  });

  it("keeps a slugless event only when it settles a submission", () => {
    const kept = filterHistoryEvents(events, card, "all");
    expect(kept.some((event) => event.action === "card-submission.reject")).toBe(true);
    expect(kept.some((event) => event.action === "candidate-card.ignore")).toBe(false);
  });

  it("drops a slugless submission settled for a card whose name only shares a prefix", () => {
    const rejections = [
      makeAuditEvent({ action: "card-submission.reject", cardSlug: null, entityLabel: "Jinx" }),
      makeAuditEvent({
        action: "card-submission.reject",
        cardSlug: null,
        entityLabel: "Jinx, Loose Cannon",
      }),
    ];

    expect(filterHistoryEvents(rejections, card, "all").map((event) => event.entityLabel)).toEqual([
      "Jinx",
    ]);
  });

  it("matches the submitted name past punctuation and case", () => {
    const rejection = makeAuditEvent({
      action: "card-submission.reject",
      cardSlug: null,
      entityLabel: "jinx!",
    });

    expect(filterHistoryEvents([rejection], card, "all")).toHaveLength(1);
  });

  it("narrows to one group", () => {
    expect(filterHistoryEvents(events, card, "submissions").map((event) => event.action)).toEqual([
      "card-submission.accept",
      "card-submission.reject",
    ]);
    expect(filterHistoryEvents(events, card, "edits").map((event) => event.action)).toEqual([
      "ban.add",
    ]);
    expect(filterHistoryEvents(events, card, "sources").map((event) => event.action)).toEqual([
      "candidates.upload",
    ]);
  });
});
