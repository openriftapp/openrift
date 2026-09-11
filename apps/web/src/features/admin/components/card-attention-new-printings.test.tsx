import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The real chip reads language colors from the /init suspense query.
vi.mock("@/components/language-chip", () => ({
  LanguageChip: ({ code }: { code: string }) => <span>{code}</span>,
}));

// oxlint-disable-next-line import/first -- must import after vi.mock
import { CardAttentionNewPrintings } from "@/features/admin/components/card-attention-new-printings";
// oxlint-disable-next-line import/first -- must import after vi.mock
import { makeAdminCardDetail, makeCandidatePrinting } from "@/test/factories";

const ownCandidate = makeCandidatePrinting({ id: "cp-own", candidateCardId: "src-a" });
const otherCandidate = makeCandidatePrinting({ id: "cp-other", candidateCardId: "src-b" });

const detail = makeAdminCardDetail({
  candidatePrintings: [ownCandidate, otherCandidate],
  candidatePrintingGroups: [
    {
      mostCommonShortCode: "OGN-001",
      shortCodes: ["cp-own"],
      expectedPrintingId: "EN:OGN-001::nonfoil",
      language: "EN",
      suggestedPrintingId: null,
    },
    {
      mostCommonShortCode: "OGN-002",
      shortCodes: ["cp-other"],
      expectedPrintingId: "EN:OGN-002::foil",
      language: "EN",
      suggestedPrintingId: null,
    },
  ],
});

describe("CardAttentionNewPrintings", () => {
  it("lists only the groups this source proposes, by printing id", () => {
    render(<CardAttentionNewPrintings detail={detail} candidateCardId="src-a" onOpen={vi.fn()} />);

    expect(screen.getByText("OGN-001::nonfoil")).toBeInTheDocument();
    expect(screen.queryByText("OGN-002::foil")).not.toBeInTheDocument();
  });

  it("opens the group card the link points at", () => {
    const onOpen = vi.fn();
    render(<CardAttentionNewPrintings detail={detail} candidateCardId="src-a" onOpen={onOpen} />);

    screen.getByRole("button").click();
    expect(onOpen).toHaveBeenCalledWith("cp-own");
  });

  it("renders nothing when the source proposes no new printing", () => {
    const { container } = render(
      <CardAttentionNewPrintings detail={detail} candidateCardId="src-c" onOpen={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
