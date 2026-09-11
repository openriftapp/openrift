import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  CandidateCardFieldKey,
  FieldDef,
} from "@/features/admin/components/candidate-field-defs";

const captured = vi.hoisted(() => ({ checkSource: vi.fn(), checkPrintings: vi.fn() }));

vi.mock("@/features/admin/hooks/use-admin-card-mutations", () => ({
  useCheckCandidateCard: () => ({ mutate: captured.checkSource, isPending: false }),
  useCheckAllCandidatePrintings: () => ({ mutate: captured.checkPrintings, isPending: false }),
}));

vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({
    labels: { rarities: {}, finishes: { foil: "Foil" }, cardSizes: {}, artVariants: {} },
  }),
}));

vi.mock("@/hooks/use-markers", () => ({ useMarkers: () => ({ data: { markers: [] } }) }));

vi.mock("@/hooks/use-languages", () => ({
  useLanguages: () => ({ data: { languages: [{ code: "EN", name: "English" }] } }),
}));

// The real chip reads language colors from the /init suspense query.
vi.mock("@/components/language-chip", () => ({
  LanguageChip: ({ code }: { code: string }) => <span>{code}</span>,
}));

// oxlint-disable-next-line import/first -- must import after vi.mock
import { makeAdminCardDetail, makeAdminPrinting } from "@/test/factories";

// oxlint-disable-next-line import/first -- must import after vi.mock
import { CardOverviewSection } from "./card-overview-section";

const fields: FieldDef<CandidateCardFieldKey>[] = [
  { key: "name", label: "Name" },
  { key: "might", label: "Might" },
  { key: "externalId", label: "External ID", readOnly: true },
];

function renderSection(overrides: Partial<React.ComponentProps<typeof CardOverviewSection>> = {}) {
  const printing = makeAdminPrinting({ id: "p-1", shortCode: "UNL-131", language: "EN" });
  const detail = makeAdminCardDetail({ printings: [printing] });
  return render(
    <CardOverviewSection
      detail={detail}
      card={{ name: "Fury Rune", might: null, externalId: "x-1" }}
      cardFields={fields}
      sourceGroups={[]}
      attentionCount={0}
      invalidates={[]}
      isAdmin
      onOpenPrinting={vi.fn()}
      onOpenAttention={vi.fn()}
      {...overrides}
    />,
  );
}

beforeEach(() => {
  captured.checkSource.mockReset();
  captured.checkPrintings.mockReset();
});

describe("CardOverviewSection", () => {
  it("lists the fields the card carries, and leaves the blank and read-only ones out", () => {
    renderSection();

    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.queryByText("Might")).not.toBeInTheDocument();
    expect(screen.queryByText("External ID")).not.toBeInTheDocument();
  });

  it("opens the printing a tile names", async () => {
    const onOpenPrinting = vi.fn();
    const user = userEvent.setup();
    renderSection({ onOpenPrinting });

    await user.click(screen.getByTitle("Open UNL-131 in Printings"));

    expect(onOpenPrinting).toHaveBeenCalledWith("p-1");
  });

  it("checks a source's rows from the sidebar", async () => {
    const user = userEvent.setup();
    renderSection({
      sourceGroups: [
        {
          key: "gallery",
          label: "gallery",
          isContributor: false,
          isTrusted: true,
          rowCount: 1,
          isChecked: false,
          candidateCardIds: ["cc-1"],
          uncheckedPrintingIds: ["cp-1"],
        },
      ],
    });

    await user.click(screen.getByRole("button", { name: "Check" }));

    expect(captured.checkSource).toHaveBeenCalledWith("cc-1");
    expect(captured.checkPrintings).toHaveBeenCalledWith({ extraIds: ["cp-1"] });
  });

  it("offers the way to Attention only while something waits there", () => {
    const { queryByText } = renderSection();
    expect(queryByText("waiting on a decision")).toBeNull();

    renderSection({ attentionCount: 3 });
    expect(screen.getByText("waiting on a decision")).toBeInTheDocument();
  });
});
