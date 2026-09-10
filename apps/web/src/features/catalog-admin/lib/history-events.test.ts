import { beforeEach, describe, expect, it } from "vitest";

import { makeAuditEvent, resetIdCounter } from "@/test/factories";

import {
  filterHistoryEvents,
  historyKind,
  historySentence,
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
  const events = [
    makeAuditEvent({ action: "ban.add", cardSlug: "OGN-001" }),
    makeAuditEvent({ action: "card-submission.accept", cardSlug: "OGN-001" }),
    makeAuditEvent({ action: "card-submission.reject", cardSlug: null }),
    makeAuditEvent({ action: "candidates.upload", cardSlug: "OGN-001" }),
    makeAuditEvent({ action: "candidate-card.ignore", cardSlug: null }),
    makeAuditEvent({ action: "printing.create", cardSlug: "OGN-002" }),
  ];

  it("drops events belonging to another card", () => {
    expect(filterHistoryEvents(events, "OGN-001", "all").map((event) => event.action)).toEqual([
      "ban.add",
      "card-submission.accept",
      "card-submission.reject",
      "candidates.upload",
    ]);
  });

  it("keeps a slugless event only when it settles a submission", () => {
    const kept = filterHistoryEvents(events, "OGN-001", "all");
    expect(kept.some((event) => event.action === "card-submission.reject")).toBe(true);
    expect(kept.some((event) => event.action === "candidate-card.ignore")).toBe(false);
  });

  it("narrows to one group", () => {
    expect(
      filterHistoryEvents(events, "OGN-001", "submissions").map((event) => event.action),
    ).toEqual(["card-submission.accept", "card-submission.reject"]);
    expect(filterHistoryEvents(events, "OGN-001", "edits").map((event) => event.action)).toEqual([
      "ban.add",
    ]);
    expect(filterHistoryEvents(events, "OGN-001", "sources").map((event) => event.action)).toEqual([
      "candidates.upload",
    ]);
  });
});
