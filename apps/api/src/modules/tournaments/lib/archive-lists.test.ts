import { describe, expect, it } from "vitest";

import {
  archiveListEligibility,
  canSendArchiveList,
  suggestArchiveListIdentities,
} from "./archive-lists.js";

const CONSENTED = { allowDeckPublishing: true, allowNameSharing: true };

describe("archiveListEligibility", () => {
  it("has nothing to send without an entry", () => {
    expect(archiveListEligibility(undefined)).toBe("no_list");
  });

  it("marks a withdrawn list before looking at consent", () => {
    expect(
      archiveListEligibility({
        state: "withdrawn",
        allowDeckPublishing: false,
        allowNameSharing: false,
      }),
    ).toBe("withdrawn");
  });

  it("needs the publishing consent", () => {
    expect(
      archiveListEligibility({
        state: "checked",
        allowDeckPublishing: false,
        allowNameSharing: true,
      }),
    ).toBe("no_consent");
  });

  it("needs the name consent", () => {
    expect(
      archiveListEligibility({
        state: "checked",
        allowDeckPublishing: true,
        allowNameSharing: false,
      }),
    ).toBe("no_name_consent");
  });

  it.each(["approved", "checked"] as const)("is ready once the deck check is %s", (state) => {
    expect(archiveListEligibility({ state, ...CONSENTED })).toBe("ready");
  });

  it.each(["editable", "submitted"] as const)("is unchecked while %s", (state) => {
    expect(archiveListEligibility({ state, ...CONSENTED })).toBe("unchecked");
  });
});

describe("canSendArchiveList", () => {
  it("sends a ready list", () => {
    expect(canSendArchiveList("ready", false)).toBe(true);
  });

  it("sends an unchecked list only when forced", () => {
    expect(canSendArchiveList("unchecked", false)).toBe(false);
    expect(canSendArchiveList("unchecked", true)).toBe(true);
  });

  it.each(["no_consent", "no_name_consent", "withdrawn", "no_list"] as const)(
    "never sends %s, forced or not",
    (eligibility) => {
      expect(canSendArchiveList(eligibility, true)).toBe(false);
    },
  );
});

describe("suggestArchiveListIdentities", () => {
  it("pairs names that match after folding case and spacing", () => {
    const suggestions = suggestArchiveListIdentities(
      [{ participantId: "p1", displayName: "  Nova  Prime" }],
      [{ identity: "u11", playerName: "nova prime" }],
    );
    expect(suggestions.get("p1")).toBe("u11");
  });

  it("suggests nothing when a name is shared on either side", () => {
    const suggestions = suggestArchiveListIdentities(
      [
        { participantId: "p1", displayName: "Nova" },
        { participantId: "p2", displayName: "Jinx" },
        { participantId: "p3", displayName: "Jinx" },
      ],
      [
        { identity: "u11", playerName: "Nova" },
        { identity: "u12", playerName: "Nova" },
        { identity: "u13", playerName: "Jinx" },
      ],
    );
    expect(suggestions.size).toBe(0);
  });

  it("ignores rows the source published without a name", () => {
    const suggestions = suggestArchiveListIdentities(
      [{ participantId: "p1", displayName: "Nova" }],
      [{ identity: "u11", playerName: null }],
    );
    expect(suggestions.size).toBe(0);
  });
});
