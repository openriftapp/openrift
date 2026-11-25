import { beforeEach, describe, expect, it } from "vitest";

import { makeCardBan, resetIdCounter } from "@/test/factories";

import {
  banDraftFromBan,
  banDraftInput,
  isBanDraftComplete,
  newBanDraft,
  selectableFormats,
} from "./ban-draft";

beforeEach(() => {
  resetIdCounter();
});

describe("newBanDraft", () => {
  it("starts on today's UTC day with an empty reason", () => {
    expect(newBanDraft("constructed", new Date("2026-09-10T22:30:00.000Z"))).toEqual({
      formatId: "constructed",
      circuit: null,
      bannedAt: "2026-09-10",
      reason: "",
    });
  });
});

describe("banDraftFromBan", () => {
  it("reads an existing ban, turning a missing reason into empty text", () => {
    expect(banDraftFromBan(makeCardBan()).reason).toBe("Locks the board out of every deck");
    expect(banDraftFromBan(makeCardBan({ reason: null })).reason).toBe("");
  });
});

describe("banDraftInput", () => {
  it("trims the reason and sends a blank one as nothing", () => {
    const draft = {
      formatId: "constructed",
      circuit: null,
      bannedAt: "2026-08-01",
      reason: "  Too strong  ",
    };
    expect(banDraftInput("card-1", draft).reason).toBe("Too strong");
    expect(banDraftInput("card-1", { ...draft, reason: "   " }).reason).toBeNull();
  });

  it("sends an empty date as undated", () => {
    const draft = { formatId: "constructed", circuit: "korea", bannedAt: "", reason: "" };
    expect(banDraftInput("card-1", draft).bannedAt).toBeNull();
  });
});

describe("isBanDraftComplete", () => {
  it("needs a format and a date", () => {
    const draft = banDraftFromBan(makeCardBan());
    expect(isBanDraftComplete(draft)).toBe(true);
    expect(isBanDraftComplete({ ...draft, formatId: "" })).toBe(false);
    expect(isBanDraftComplete({ ...draft, bannedAt: "" })).toBe(false);
  });

  it("lets a circuit ban go without a date", () => {
    const draft = banDraftFromBan(makeCardBan({ circuit: "korea", bannedAt: null }));
    expect(draft.bannedAt).toBe("");
    expect(isBanDraftComplete(draft)).toBe(true);
  });
});

describe("selectableFormats", () => {
  const formats = [
    { id: "constructed", name: "Constructed" },
    { id: "draft", name: "Draft" },
  ];

  it("drops a format the card is already banned in", () => {
    const bans = [makeCardBan({ formatId: "constructed" })];
    expect(selectableFormats(formats, bans, null).map((format) => format.id)).toEqual(["draft"]);
  });

  it("keeps a format banned only in another circuit", () => {
    const bans = [makeCardBan({ formatId: "constructed" })];
    expect(selectableFormats(formats, bans, "korea")).toHaveLength(2);
  });

  it("keeps every format when nothing is banned", () => {
    expect(selectableFormats(formats, [], null)).toHaveLength(2);
  });
});
