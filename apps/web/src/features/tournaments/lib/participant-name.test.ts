import { describe, expect, it } from "vitest";

import { participantName } from "./participant-name";

describe("participantName", () => {
  it("keeps a stored name", () => {
    expect(participantName("Ashe")).toBe("Ashe");
  });

  it("names a deleted account as a former member", () => {
    expect(participantName(null)).toBe("Former member");
  });
});
