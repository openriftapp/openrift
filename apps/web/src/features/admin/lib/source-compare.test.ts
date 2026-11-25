import { beforeEach, describe, expect, it } from "vitest";

import {
  makeAdminPrinting,
  makeCandidatePrinting,
  makeProviderSetting,
  resetIdCounter,
} from "@/test/factories";

import { candidateBelongsToFace, hiddenProviders } from "./source-compare";

beforeEach(() => {
  resetIdCounter();
});

describe("hiddenProviders", () => {
  const settings = [
    makeProviderSetting({ provider: "hidden", isHidden: true, helperReviewable: true }),
    makeProviderSetting({ provider: "admin-only", helperReviewable: false }),
    makeProviderSetting({ provider: "open", helperReviewable: true }),
  ];

  it("hides a hidden provider from everyone", () => {
    expect([...hiddenProviders(settings, true)]).toEqual(["hidden"]);
  });

  it("also hides a provider outside a helper's scope", () => {
    expect([...hiddenProviders(settings, false)].toSorted()).toEqual(["admin-only", "hidden"]);
  });
});

describe("candidateBelongsToFace", () => {
  const front = makeAdminPrinting({ id: "p1", side: 1, faceId: "f1", shortCode: "UNL-T02" });
  const back = makeAdminPrinting({ id: "p1", side: 2, faceId: "f2", shortCode: "UNL-T03" });

  it("rejects an unlinked candidate", () => {
    expect(candidateBelongsToFace(makeCandidatePrinting(), "f1", [front])).toBe(false);
  });

  it("accepts a candidate on a printing that shows the face once", () => {
    const candidate = makeCandidatePrinting({ printingId: "p1", shortCode: "anything" });
    expect(candidateBelongsToFace(candidate, "f1", [front])).toBe(true);
  });

  it("splits a printing with this card on both faces by short code", () => {
    const backCode = makeCandidatePrinting({ printingId: "p1", shortCode: "unl-t03" });
    expect(candidateBelongsToFace(backCode, "f2", [front, back])).toBe(true);
    expect(candidateBelongsToFace(backCode, "f1", [front, back])).toBe(false);
  });

  it("falls back to the front face when the code matches neither face", () => {
    const other = makeCandidatePrinting({ printingId: "p1", shortCode: "OGN-001" });
    expect(candidateBelongsToFace(other, "f1", [front, back])).toBe(true);
    expect(candidateBelongsToFace(other, "f2", [front, back])).toBe(false);
  });
});
