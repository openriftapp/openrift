import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type * as CardDetailShared from "@/features/admin/components/card-detail-shared";
import type { PrintingGroup } from "@/features/admin/lib/candidate-printing-groups";

const spreadsheetProps: { costKeywords?: readonly string[] } = {};
vi.mock("@/features/admin/components/candidate-spreadsheet", () => ({
  CandidateSpreadsheet: (props: { costKeywords?: readonly string[] }) => {
    spreadsheetProps.costKeywords = props.costKeywords;
    return null;
  },
}));

vi.mock("@/components/language-chip", () => ({
  LanguageChip: ({ code }: { code: string }) => code,
}));

// The group card pulls its mutations from useCardDetailData; stub them so the
// component renders without a QueryClient. buildPrintingNormalizer stays real.
vi.mock("@/features/admin/components/card-detail-shared", async () => {
  const actual = await vi.importActual<typeof CardDetailShared>(
    "@/features/admin/components/card-detail-shared",
  );
  const stubMutation = { mutate: vi.fn(), isPending: false };
  return {
    ...actual,
    useCardDetailData: () => ({
      checkPrintingSource: stubMutation,
      uncheckPrintingSource: stubMutation,
      checkAllCandidatePrintings: stubMutation,
    }),
  };
});

// oxlint-disable-next-line import/first -- must import after vi.mock
import { NewPrintingGroupCard } from "./new-printing-group-card";

const group = {
  groupKey: "g1",
  expectedPrintingId: "AAA-001",
  candidates: [],
} as unknown as PrintingGroup & { groupKey: string };

const noop = () => {};

describe("NewPrintingGroupCard", () => {
  it("forwards costKeywords to the candidate spreadsheet's Fix reformat", () => {
    render(
      <NewPrintingGroupCard
        group={group}
        existingPrintings={[]}
        providerLabels={{}}
        providerNames={{}}
        providerSubmitters={{}}
        providerSettings={[]}
        setTotals={{}}
        setReleaseYears={{}}
        isExpanded
        onToggle={noop}
        onAccept={noop}
        onLink={noop}
        onCopy={noop}
        onDelete={noop}
        onIgnore={noop}
        isAccepting={false}
        isAdmin
        printingFields={[]}
        costKeywords={["Empower"]}
        invalidates={[]}
      />,
    );

    expect(spreadsheetProps.costKeywords).toEqual(["Empower"]);
  });

  it("offers a one-click assign to the suggested printing when no exact match exists", () => {
    const onLink = vi.fn();
    const suggestedGroup = {
      groupKey: "g1",
      expectedPrintingId: "OGN-066:promo:foil",
      suggestedPrintingId: "p-le",
      candidates: [{ id: "cp-1" }, { id: "cp-2" }],
    } as unknown as PrintingGroup & { groupKey: string };
    const existing = [
      { id: "p-le", expectedPrintingId: "OGN-066:launch-exclusive:foil" },
    ] as never[];

    const { getByText } = render(
      <NewPrintingGroupCard
        group={suggestedGroup}
        existingPrintings={existing}
        providerLabels={{}}
        providerNames={{}}
        providerSubmitters={{}}
        providerSettings={[]}
        setTotals={{}}
        setReleaseYears={{}}
        isExpanded={false}
        onToggle={noop}
        onAccept={noop}
        onLink={onLink}
        onCopy={noop}
        onDelete={noop}
        onIgnore={noop}
        isAccepting={false}
        isAdmin
        printingFields={[]}
        invalidates={[]}
      />,
    );

    getByText("Assign all to OGN-066:launch-exclusive:foil").click();
    expect(onLink).toHaveBeenCalledWith("p-le", ["cp-1", "cp-2"]);
  });

  it("keeps the exact-match assign button when the expected id matches an existing printing", () => {
    const exactGroup = {
      groupKey: "g1",
      expectedPrintingId: "OGN-066::foil",
      suggestedPrintingId: "p-exact",
      candidates: [],
    } as unknown as PrintingGroup & { groupKey: string };
    const existing = [{ id: "p-exact", expectedPrintingId: "OGN-066::foil" }] as never[];

    const { getByText, queryByText } = render(
      <NewPrintingGroupCard
        group={exactGroup}
        existingPrintings={existing}
        providerLabels={{}}
        providerNames={{}}
        providerSubmitters={{}}
        providerSettings={[]}
        setTotals={{}}
        setReleaseYears={{}}
        isExpanded={false}
        onToggle={noop}
        onAccept={noop}
        onLink={noop}
        onCopy={noop}
        onDelete={noop}
        onIgnore={noop}
        isAccepting={false}
        isAdmin
        printingFields={[]}
        invalidates={[]}
      />,
    );

    expect(getByText("Assign all to existing")).toBeTruthy();
    expect(queryByText(/Assign all to OGN-066/u)).toBeNull();
  });

  it("derives the header short code from the public code", () => {
    const seededGroup = {
      groupKey: "g1",
      expectedPrintingId: "undefined::foil",
      candidates: [
        {
          id: "cp-1",
          candidateCardId: "cc-1",
          rarity: "rare",
          artVariant: "standard",
          isSigned: false,
          finish: "foil",
          language: "EN",
          artist: "Someone",
          publicCode: "SFD-118a/221-P",
        },
      ],
    } as unknown as PrintingGroup & { groupKey: string };
    const printingFields = [
      { key: "rarity", label: "Rarity" },
      { key: "artVariant", label: "Art Variant" },
      { key: "isSigned", label: "Signed", type: "boolean" },
      { key: "finish", label: "Finish" },
      { key: "language", label: "Language" },
      { key: "artist", label: "Artist" },
      { key: "publicCode", label: "Public Code" },
    ] as never[];

    const { getByText, queryByText } = render(
      <NewPrintingGroupCard
        group={seededGroup}
        existingPrintings={[]}
        providerLabels={{}}
        providerNames={{}}
        providerSubmitters={{}}
        providerSettings={[]}
        setTotals={{}}
        setReleaseYears={{}}
        isExpanded={false}
        onToggle={noop}
        onAccept={noop}
        onLink={noop}
        onCopy={noop}
        onDelete={noop}
        onIgnore={noop}
        isAccepting={false}
        isAdmin
        printingFields={printingFields}
        invalidates={[]}
      />,
    );

    expect(getByText("SFD-118a::foil")).toBeTruthy();
    expect(queryByText(/undefined/u)).toBeNull();
  });
});
