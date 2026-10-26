import type { WorkspaceEvent } from "@openrift/shared/contracts/admin/catalog-workspace";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-fns/orpc-client", () => ({ apiOrpcClient: vi.fn() }));

const { decisionSentence, decisionTarget, newestFirst } = await import("./use-workspace-decisions");

function decision(overrides: Partial<WorkspaceEvent>): WorkspaceEvent {
  return {
    id: crypto.randomUUID(),
    action: "card.update",
    label: "Jinx, Loose Cannon",
    entityType: "card",
    entityId: "0190a000-0000-7000-8000-000000000001",
    cardSlug: "jinx-loose-cannon",
    createdAt: "2026-10-26T09:00:00.000Z",
    ...overrides,
  };
}

describe("newestFirst", () => {
  it("orders events by time, newest first", () => {
    const events = [
      decision({ id: "a", createdAt: "2026-10-26T08:00:00.000Z" }),
      decision({ id: "b", createdAt: "2026-10-26T10:00:00.000Z" }),
      decision({ id: "c", createdAt: "2026-10-26T09:00:00.000Z" }),
    ];
    expect(newestFirst(events).map((event) => event.id)).toEqual(["b", "c", "a"]);
  });
});

describe("decisionSentence", () => {
  it("uses the history action sentence without repeating the label", () => {
    expect(decisionSentence(decision({ action: "card.update" }))).toBe("Edited the card");
    expect(decisionSentence(decision({ action: "printing.accept", entityType: "printing" }))).toBe(
      "Added a printing",
    );
  });

  it("falls back to the raw action for an unknown one", () => {
    expect(decisionSentence(decision({ action: "card.something-new" }))).toBe("card.something-new");
  });
});

describe("decisionTarget", () => {
  it("links a printing event to its printing", () => {
    expect(decisionTarget(decision({ entityType: "printing", entityId: "p1" }))).toEqual({
      kind: "printing",
      printingId: "p1",
    });
  });

  it("links a face event to its face", () => {
    expect(decisionTarget(decision({ entityType: "face", entityId: "f1" }))).toEqual({
      kind: "face",
      cardSlug: "jinx-loose-cannon",
      faceId: "f1",
    });
  });

  it("links other events with a card to the card", () => {
    expect(decisionTarget(decision({ entityType: "image", entityId: "i1" }))).toEqual({
      kind: "card",
      cardSlug: "jinx-loose-cannon",
    });
  });

  it("returns null when the event names no record", () => {
    expect(
      decisionTarget(decision({ entityType: "upload", entityId: null, cardSlug: null })),
    ).toBeNull();
  });
});
