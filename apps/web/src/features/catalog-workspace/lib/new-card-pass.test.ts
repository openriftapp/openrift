import { beforeEach, describe, expect, it } from "vitest";

import type { PrintingValueLabels } from "@/features/admin/lib/field-value-text";
import { makeCandidateCard, makeCandidatePrinting, resetIdCounter } from "@/test/factories";

import { draftFromCandidatePrinting } from "./creation-draft";
import {
  newCardCreateLabel,
  newCardFieldRows,
  printingGroupLines,
  printingGroupProviders,
} from "./new-card-pass";

beforeEach(() => {
  resetIdCounter();
});

describe("newCardCreateLabel", () => {
  it("counts the ticked printings", () => {
    expect(newCardCreateLabel(0)).toBe("Create card");
    expect(newCardCreateLabel(1)).toBe("Create card and 1 printing");
    expect(newCardCreateLabel(3)).toBe("Create card and 3 printings");
  });
});

describe("newCardFieldRows", () => {
  const FIELDS = [
    { key: "externalId", label: "External ID", readOnly: true },
    { key: "might", label: "Might" },
    { key: "domains", label: "Domains" },
    { key: "rulesText", label: "Rules Text" },
  ];
  const usable = () => true;

  it("lists only card columns and shows the pick with no alternatives when sources agree", () => {
    const sources = [
      makeCandidateCard({ provider: "provider-a", might: 3 }),
      makeCandidateCard({ provider: "provider-b", might: 3 }),
    ];

    const rows = newCardFieldRows(FIELDS, sources, { might: 3, domains: ["calm"] }, usable);

    expect(rows.map((row) => row.key)).toEqual(["might", "domains"]);
    expect(rows[0]).toMatchObject({ value: 3, alternatives: [] });
  });

  it("groups each other value with every source that sent it", () => {
    const sources = [
      makeCandidateCard({ provider: "provider-a", might: 3 }),
      makeCandidateCard({ provider: "provider-b", might: 4 }),
      makeCandidateCard({ provider: "provider-c", might: 4 }),
      makeCandidateCard({ provider: "usersubmission", might: 5, submittedByName: "Renata" }),
    ];

    const [might] = newCardFieldRows(FIELDS, sources, { might: 3 }, usable);

    expect(might?.alternatives).toEqual([
      { key: "4", value: 4, sources: ["provider-b", "provider-c"] },
      { key: "5", value: 5, sources: ["Renata"] },
    ]);
  });

  it("leaves out empty and unusable values and shows a missing pick as null", () => {
    const sources = [
      makeCandidateCard({ provider: "provider-a", might: null, domains: ["chaos"] }),
      makeCandidateCard({ provider: "provider-b", might: null, domains: ["nowhere"] }),
    ];

    const rows = newCardFieldRows(
      FIELDS,
      sources,
      {},
      (_field, value) => !(Array.isArray(value) && value.includes("nowhere")),
    );

    expect(rows[0]).toMatchObject({ key: "might", value: null, alternatives: [] });
    expect(rows[1]?.alternatives.map((entry) => entry.value)).toEqual([["chaos"]]);
  });
});

describe("printingGroupLines", () => {
  const labels = {} as PrintingValueLabels;

  it("summarises the draft and names its sources", () => {
    const source = makeCandidateCard({ provider: "provider-a" });
    const candidate = makeCandidatePrinting({
      candidateCardId: source.id,
      shortCode: "OGN-007",
      publicCode: "OGN-007/298",
      language: "EN",
      size: "standard",
      distributionChannelSlugs: [],
    });
    const draft = draftFromCandidatePrinting(
      { mode: "new", slug: "lux", name: "Lux", summary: "" },
      candidate,
      "provider-a",
      {},
      true,
    );
    const providers = printingGroupProviders(draft, [candidate], [source]);

    const lines = printingGroupLines(draft, providers, labels);

    expect(providers).toEqual(["provider-a"]);
    expect(lines.summary).toContain("EN");
    expect(lines.details).toContain("from provider-a");
  });

  it("names an existing second face", () => {
    const candidate = makeCandidatePrinting({ language: "EN" });
    const draft = draftFromCandidatePrinting(
      { mode: "new", slug: "lux", name: "Lux", summary: "" },
      candidate,
      "provider-a",
      {},
      true,
    );
    const [first] = draft.faces;
    if (first === undefined) {
      throw new Error("no face");
    }
    const withSecond = {
      ...draft,
      faces: [
        first,
        {
          mode: "existing" as const,
          faceId: "face-2",
          label: "Lux, Illuminated · OGN-008 · EN",
          cardSlug: "lux-illuminated",
          printingId: "printing-2",
          fields: first.fields,
          images: [],
        },
      ],
    };

    expect(printingGroupLines(withSecond, [], labels).details).toContain(
      "second face Lux, Illuminated · OGN-008 · EN",
    );
  });

  it("names no source for a group whose rows are gone", () => {
    const candidate = makeCandidatePrinting();
    const draft = draftFromCandidatePrinting(
      { mode: "new", slug: "lux", name: "Lux", summary: "" },
      candidate,
      "provider-a",
      {},
      true,
    );

    expect(printingGroupProviders(draft, [candidate], [])).toEqual([]);
    expect(printingGroupLines(draft, [], labels).details).not.toContain("from");
  });
});
