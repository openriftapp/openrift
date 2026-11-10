import type {
  CardSubmissionKind,
  CardSubmissionReason,
  CardSubmissionStatus,
} from "@openrift/shared/contracts/card-submissions";
import { describe, expect, it } from "vitest";

import {
  submissionKindLabels,
  submissionReasonLabels,
  submissionReasonSentence,
  submissionReasonSentences,
  submissionStatusBadgeVariant,
  submissionStatusHints,
  submissionStatusLabels,
} from "./card-submission-copy";

const STATUSES: CardSubmissionStatus[] = [
  "pending",
  "accepted",
  "already_correct",
  "not_applied",
  "rejected",
];
const REASONS: CardSubmissionReason[] = [
  "duplicate",
  "already_correct",
  "unverified",
  "not_a_card",
  "bad_image",
];
const KINDS: CardSubmissionKind[] = ["new_card", "correction", "image"];

describe("copy coverage", () => {
  it("has a label, variant and hint entry for every status", () => {
    for (const status of STATUSES) {
      expect(submissionStatusLabels()[status]).toBeTruthy();
      expect(submissionStatusBadgeVariant[status]).toBeTruthy();
      expect(submissionStatusHints()).toHaveProperty(status);
    }
  });

  it("has a sentence and a short label for every reason", () => {
    for (const reason of REASONS) {
      expect(submissionReasonSentences()[reason]).toBeTruthy();
      expect(submissionReasonLabels()[reason]).toBeTruthy();
    }
  });

  it("has a label for every kind", () => {
    for (const kind of KINDS) {
      expect(submissionKindLabels()[kind]).toBeTruthy();
    }
  });

  it("shows the same wording for not_applied and rejected, to hide the internal abuse signal", () => {
    expect(submissionStatusLabels().not_applied).toBe(submissionStatusLabels().rejected);
    expect(submissionStatusBadgeVariant.not_applied).toBe(submissionStatusBadgeVariant.rejected);
  });

  it("uses no internal pipeline vocabulary", () => {
    const allCopy = [
      ...Object.values(submissionStatusLabels()),
      ...Object.values(submissionReasonSentences()),
      ...Object.values(submissionKindLabels()),
      ...Object.values(submissionStatusHints()).filter((hint) => hint !== null),
    ].join(" ");
    for (const jargon of ["candidate", "provider", "ignored", "staging", "usersubmission"]) {
      expect(allCopy.toLowerCase()).not.toContain(jargon);
    }
  });
});

describe("submissionReasonSentence", () => {
  it("keeps the reason when the admin also wrote a note", () => {
    expect(submissionReasonSentence("not_a_card", "This looks like a fan-made card.")).toBe(
      submissionReasonSentences().not_a_card,
    );
  });

  it("returns the canned sentence for the reason", () => {
    expect(submissionReasonSentence("duplicate", null)).toBe(submissionReasonSentences().duplicate);
  });

  it("returns nothing for a submission settled without a reason", () => {
    expect(submissionReasonSentence(null, null)).toBeNull();
    expect(submissionReasonSentence(null, "Thanks, added.")).toBeNull();
  });

  it("drops the other sentence when there is no note for it to point at", () => {
    expect(submissionReasonSentence("other", null)).toBeNull();
    expect(submissionReasonSentence("other", "Wrong set.")).toBe(submissionReasonSentences().other);
  });
});

describe("submissionStatusHints", () => {
  it("gives a reasonless not-used submission a neutral line, the same for both statuses", () => {
    const hints = submissionStatusHints();
    expect(hints.rejected).toBeTruthy();
    expect(hints.rejected).toBe(hints.not_applied);
  });
});
