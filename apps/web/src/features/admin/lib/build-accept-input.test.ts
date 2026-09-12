import { beforeEach, describe, expect, it } from "vitest";

import {
  resetIdCounter,
  makeAdminCard,
  makeAdminCardDetail,
  makeAdminPrinting,
  makeCandidateCard,
  makeCandidatePrinting,
} from "@/test/factories";

import { buildAttentionSubmissions } from "./attention-items";
import {
  buildAcceptSubmissionInput,
  printingGroupTickKeys,
  submissionTickKeys,
} from "./build-accept-input";

beforeEach(() => {
  resetIdCounter();
});

function cardOnlySubmission() {
  const card = makeAdminCard({ name: "Lux, Lady of Luminosity", might: 3 });
  const detail = makeAdminCardDetail({
    card,
    sources: [makeCandidateCard({ name: "Lux, Lady of Light", might: 5 })],
  });
  const submission = buildAttentionSubmissions(detail, [])[0];
  if (!submission) {
    throw new Error("expected a submission");
  }
  return submission;
}

describe("buildAcceptSubmissionInput", () => {
  it("sends every ticked card field with the provider's own value", () => {
    const submission = cardOnlySubmission();
    const { input } = buildAcceptSubmissionInput(submission, {
      ticked: new Set(submissionTickKeys(submission)),
      edits: new Map(),
    });
    expect(input.candidateCardId).toBe(submission.candidateCardId);
    expect(input.cardFields).toEqual([
      { field: "name", value: "Lux, Lady of Light" },
      { field: "might", value: 5 },
    ]);
  });

  it("drops unticked rows", () => {
    const submission = cardOnlySubmission();
    const nameKey = submissionTickKeys(submission).find((key) => key.endsWith(":name"));
    const { input } = buildAcceptSubmissionInput(submission, {
      ticked: new Set(nameKey === undefined ? [] : [nameKey]),
      edits: new Map(),
    });
    expect(input.cardFields?.map((pick) => pick.field)).toEqual(["name"]);
  });

  it("sends the reviewer's replacement in place of the incoming value", () => {
    const submission = cardOnlySubmission();
    const nameKey = submissionTickKeys(submission).find((key) => key.endsWith(":name")) ?? "";
    const { input } = buildAcceptSubmissionInput(submission, {
      ticked: new Set([nameKey]),
      edits: new Map([[nameKey, "Lux, Lady of Luminosity"]]),
    });
    expect(input.cardFields).toEqual([{ field: "name", value: "Lux, Lady of Luminosity" }]);
  });

  it("marks an edited printing field as manual", () => {
    const source = makeCandidateCard({ name: "Lux, Lady of Luminosity" });
    const printing = makeAdminPrinting({ artist: "Old Artist" });
    const detail = makeAdminCardDetail({
      card: makeAdminCard({ name: source.name }),
      sources: [source],
      printings: [printing],
      candidatePrintings: [
        makeCandidatePrinting({
          candidateCardId: source.id,
          printingId: printing.id,
          artist: "New Artist",
        }),
      ],
    });
    const submission = buildAttentionSubmissions(detail, [])[0];
    if (!submission) {
      throw new Error("expected a submission");
    }
    const artistKey = submissionTickKeys(submission).find((key) => key.endsWith(":artist")) ?? "";
    const { input } = buildAcceptSubmissionInput(submission, {
      ticked: new Set([artistKey]),
      edits: new Map([[artistKey, "Reviewed Artist"]]),
    });
    expect(input.printingFields).toEqual([
      {
        printingId: printing.id,
        field: "artist",
        value: "Reviewed Artist",
        source: "manual",
      },
    ]);
  });

  it("keys printing picks by the linked printing id", () => {
    const source = makeCandidateCard({ name: "Lux, Lady of Luminosity" });
    const printing = makeAdminPrinting({ artist: "Old Artist" });
    const detail = makeAdminCardDetail({
      card: makeAdminCard({ name: source.name }),
      sources: [source],
      printings: [printing],
      candidatePrintings: [
        makeCandidatePrinting({
          candidateCardId: source.id,
          printingId: printing.id,
          artist: "New Artist",
        }),
      ],
    });
    const submission = buildAttentionSubmissions(detail, [])[0];
    if (!submission) {
      throw new Error("expected a submission");
    }
    const { input } = buildAcceptSubmissionInput(submission, {
      ticked: new Set(submissionTickKeys(submission)),
      edits: new Map(),
    });
    expect(input.printingFields).toEqual([
      { printingId: printing.id, field: "artist", value: "New Artist", source: "provider" },
    ]);
    expect(input.cardFields).toEqual([]);
  });

  it("turns an image row into an image pick, not a field pick", () => {
    const source = makeCandidateCard({ name: "Lux, Lady of Luminosity" });
    const printing = makeAdminPrinting();
    const candidate = makeCandidatePrinting({
      candidateCardId: source.id,
      printingId: printing.id,
      artist: printing.artist,
      publicCode: printing.publicCode,
      shortCode: printing.shortCode,
      setId: printing.setId,
      rarity: printing.rarity,
      artVariant: printing.artVariant,
      finish: printing.finish,
      size: printing.size,
      language: printing.language,
      printedYear: printing.printedYear,
      imageUrl: "https://example.test/lux.png",
    });
    const detail = makeAdminCardDetail({
      card: makeAdminCard({ name: source.name }),
      sources: [source],
      printings: [printing],
      candidatePrintings: [candidate],
    });
    const submission = buildAttentionSubmissions(detail, [])[0];
    if (!submission) {
      throw new Error("expected a submission");
    }
    const { input } = buildAcceptSubmissionInput(submission, {
      ticked: new Set(submissionTickKeys(submission)),
      edits: new Map(),
    });
    expect(input.images).toEqual([{ candidatePrintingId: candidate.id, printingId: printing.id }]);
    expect(input.printingFields).toEqual([]);
  });

  it("assembles printing fields for a ticked new printing", () => {
    const source = makeCandidateCard({ name: "Lux, Lady of Luminosity" });
    const candidate = makeCandidatePrinting({
      candidateCardId: source.id,
      printingId: null,
      shortCode: "OGN-042",
      artist: "Riot Artist",
      publicCode: "OGN-042/300",
    });
    const detail = makeAdminCardDetail({
      card: makeAdminCard({ name: source.name }),
      sources: [source],
      candidatePrintings: [candidate],
    });
    const submission = buildAttentionSubmissions(detail, [])[0];
    if (!submission) {
      throw new Error("expected a submission");
    }
    const { input } = buildAcceptSubmissionInput(submission, {
      ticked: new Set(submissionTickKeys(submission)),
      edits: new Map(),
    });
    expect(input.newPrintings).toHaveLength(1);
    expect(input.newPrintings?.[0]?.candidatePrintingId).toBe(candidate.id);
    expect(input.newPrintings?.[0]?.printingFields.shortCode).toBe("OGN-042");
    expect(input.newPrintings?.[0]?.printingFields.artist).toBe("Riot Artist");
  });

  it("sends empty arrays when nothing is ticked", () => {
    const submission = cardOnlySubmission();
    const { input, includedKeys } = buildAcceptSubmissionInput(submission, {
      ticked: new Set(),
      edits: new Map(),
    });
    expect(includedKeys.size).toBe(0);
    expect(input.cardFields).toEqual([]);
    expect(input.printingFields).toEqual([]);
    expect(input.newPrintings).toEqual([]);
    expect(input.images).toEqual([]);
  });
});

describe("includedKeys", () => {
  it("reports only the ticks that survived into the input", () => {
    const submission = cardOnlySubmission();
    const keys = submissionTickKeys(submission);
    const { includedKeys } = buildAcceptSubmissionInput(submission, {
      ticked: new Set(keys),
      edits: new Map(),
    });
    expect([...includedKeys].toSorted()).toEqual(keys.toSorted());
  });

  it("leaves out a ticked change the input cannot carry", () => {
    const submission = cardOnlySubmission();
    const unknownField = {
      key: "card:c1:notAField",
      field: "notAField",
      label: "Not a field",
      current: null,
      proposed: "x",
      kind: "value" as const,
    };
    const group = submission.groups[0];
    if (!group) {
      throw new Error("expected a group");
    }
    group.changes.push(unknownField);
    const { input, includedKeys } = buildAcceptSubmissionInput(submission, {
      ticked: new Set(submissionTickKeys(submission)),
      edits: new Map(),
    });
    expect(includedKeys.has(unknownField.key)).toBe(false);
    expect(input.cardFields?.map((pick) => pick.field)).not.toContain("notAField");
  });
});

describe("printingGroupTickKeys", () => {
  it("returns the change keys of every group on that printing", () => {
    const source = makeCandidateCard({ name: "Lux, Lady of Luminosity" });
    const moved = makeAdminPrinting({ artist: "Old Artist" });
    const kept = makeAdminPrinting({ artist: "Old Artist" });
    const first = makeCandidatePrinting({
      candidateCardId: source.id,
      printingId: moved.id,
      artist: "New Artist",
    });
    const second = makeCandidatePrinting({
      candidateCardId: source.id,
      printingId: moved.id,
      artist: "Other Artist",
    });
    const elsewhere = makeCandidatePrinting({
      candidateCardId: source.id,
      printingId: kept.id,
      artist: "Third Artist",
    });
    const detail = makeAdminCardDetail({
      card: makeAdminCard({ name: source.name }),
      sources: [source],
      printings: [moved, kept],
      candidatePrintings: [first, second, elsewhere],
    });
    const submission = buildAttentionSubmissions(detail, [])[0];
    if (!submission) {
      throw new Error("expected a submission");
    }
    expect(printingGroupTickKeys(submission, moved.id)).toEqual([
      `printing:${first.id}:artist`,
      `printing:${second.id}:artist`,
    ]);
    expect(printingGroupTickKeys(submission, kept.id)).toEqual([`printing:${elsewhere.id}:artist`]);
  });

  it("returns nothing for a printing the submission does not touch", () => {
    expect(printingGroupTickKeys(cardOnlySubmission(), "prt-nope")).toEqual([]);
  });
});
