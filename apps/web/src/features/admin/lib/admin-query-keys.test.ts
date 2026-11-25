import { describe, expect, it } from "vitest";

import { adminKeys, CANDIDATE_REVIEW_SCOPE } from "./admin-query-keys";

describe("CANDIDATE_REVIEW_SCOPE", () => {
  it("covers the card pages, the review inbox and the workspace", () => {
    expect(CANDIDATE_REVIEW_SCOPE).toEqual([
      ["admin", "cards"],
      ["admin", "review-queue"],
      ["admin", "workspace"],
    ]);
  });
});

describe("adminKeys", () => {
  it("workspace prefixes the candidate printing lookup and the records lists", () => {
    const prefix = adminKeys.workspace;
    expect(adminKeys.workspaceCandidatePrintingCard("cp-1").slice(0, prefix.length)).toEqual(
      prefix,
    );
    expect(adminKeys.workspaceRecords({ kind: "printing" }).slice(0, prefix.length)).toEqual(
      prefix,
    );
  });

  it("me is keyed per user so identities never share a cache slot", () => {
    expect(adminKeys.me("user-1")).toEqual(["admin", "me", "user-1"]);
    expect(adminKeys.me(null)).toEqual(["admin", "me", null]);
    expect(adminKeys.me("user-1")).not.toEqual(adminKeys.me("user-2"));
  });

  it("sets", () => {
    expect(adminKeys.sets).toEqual(["admin", "sets"]);
  });

  it("audit keys", () => {
    expect(adminKeys.audit.events({ action: "x" })).toEqual([
      "admin",
      "audit-events",
      { action: "x" },
    ]);
    expect(adminKeys.audit.actors).toEqual(["admin", "audit-actors"]);
    expect(adminKeys.audit.actions).toEqual(["admin", "audit-actions"]);
  });

  it("printingEvents", () => {
    expect(adminKeys.printingEvents).toEqual(["admin", "printing-events"]);
  });

  it("marketplaceGroups", () => {
    expect(adminKeys.marketplaceGroups).toEqual(["admin", "marketplace-groups"]);
  });

  it("featureFlags", () => {
    expect(adminKeys.featureFlags).toEqual(["admin", "feature-flags"]);
  });

  it("jobSchedules", () => {
    expect(adminKeys.jobSchedules).toEqual(["admin", "job-schedules"]);
  });

  it("rehostStatus", () => {
    expect(adminKeys.rehostStatus).toEqual(["admin", "rehost-status"]);
  });

  it("ignoredProducts", () => {
    expect(adminKeys.ignoredProducts).toEqual(["admin", "ignored-products"]);
  });
});

describe("adminKeys.cards", () => {
  it("all", () => {
    expect(adminKeys.cards.all).toEqual(["admin", "cards"]);
  });

  it("list", () => {
    expect(adminKeys.cards.list).toEqual(["admin", "cards", "list"]);
  });

  it("detail", () => {
    expect(adminKeys.cards.detail("id")).toEqual(["admin", "cards", "detail", "id"]);
  });

  it("unmatched", () => {
    expect(adminKeys.cards.unmatched("name")).toEqual(["admin", "cards", "unmatched", "name"]);
  });

  it("allCards", () => {
    expect(adminKeys.cards.allCards).toEqual(["admin", "cards", "all-cards"]);
  });
});

describe("adminKeys.printingDesk", () => {
  it("all is the prefix every desk read sits under", () => {
    expect(adminKeys.printingDesk.all).toEqual(["admin", "printing-desk"]);
  });

  it("list keys per mode", () => {
    expect(adminKeys.printingDesk.list("mine")).toEqual(["admin", "printing-desk", "list", "mine"]);
    expect(adminKeys.printingDesk.list("mine")).not.toEqual(adminKeys.printingDesk.list("all"));
  });

  it("cardPrintings keys per card slug", () => {
    expect(adminKeys.printingDesk.cardPrintings("annie")).toEqual([
      "admin",
      "printing-desk",
      "card",
      "annie",
    ]);
  });

  it("printing keys per id and exposes a prefix", () => {
    expect(adminKeys.printingDesk.printing("p-1")).toEqual([
      "admin",
      "printing-desk",
      "printing",
      "p-1",
    ]);
    expect(adminKeys.printingDesk.printing.prefix).toEqual(["admin", "printing-desk", "printing"]);
  });

  it("every desk key starts with the desk prefix", () => {
    const prefix = adminKeys.printingDesk.all;
    for (const key of [
      adminKeys.printingDesk.list("all"),
      adminKeys.printingDesk.cardPrintings("annie"),
      adminKeys.printingDesk.printing("p-1"),
      adminKeys.printingDesk.printing.prefix,
    ]) {
      expect(key.slice(0, prefix.length)).toEqual(prefix);
    }
  });
});

describe("adminKeys.unifiedMappings", () => {
  it("all", () => {
    expect(adminKeys.unifiedMappings.all).toEqual(["admin", "unified-mappings"]);
  });

  it("list", () => {
    expect(adminKeys.unifiedMappings.list).toEqual(["admin", "unified-mappings", "list"]);
    expect(adminKeys.unifiedMappings.summary()).toEqual([
      "admin",
      "unified-mappings",
      "summary",
      null,
    ]);
    expect(adminKeys.unifiedMappings.summary("OGN")).toEqual([
      "admin",
      "unified-mappings",
      "summary",
      "OGN",
    ]);
  });

  it("byCard", () => {
    expect(adminKeys.unifiedMappings.byCard("c-1")).toEqual([
      "admin",
      "unified-mappings",
      "card",
      "c-1",
    ]);
  });
});
