import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CandidateSpreadsheetHeader } from "@/features/admin/components/candidate-spreadsheet-header";
import type { SourceSubmitter } from "@/features/admin/lib/candidate-submitter";

function renderHeader(
  rows: { id: string; checkedAt: string | null; provider?: string; candidateCardId?: string }[],
  submitters: Record<string, SourceSubmitter> = {},
  favoriteProviders = new Set<string>(),
) {
  return render(
    <table>
      <CandidateSpreadsheetHeader
        sortedRows={rows}
        submitters={submitters}
        favoriteProviders={favoriteProviders}
      />
    </table>,
  );
}

describe("CandidateSpreadsheetHeader", () => {
  it("titles a contribution by who sent it", () => {
    renderHeader([{ id: "cc1", checkedAt: null, provider: "usersubmission" }], {
      cc1: { userId: "u1", name: "Moritaka", note: null },
    });

    expect(screen.getByText("Moritaka")).toBeInTheDocument();
    expect(screen.queryByText("usersubmission")).not.toBeInTheDocument();
    expect(screen.queryByText(/^by /u)).not.toBeInTheDocument();
  });

  it("falls back to Contributor when the submission carries no attribution", () => {
    renderHeader([{ id: "cc1", checkedAt: null, provider: "usersubmission" }]);

    expect(screen.getByText("Contributor")).toBeInTheDocument();
  });

  it("badges an unchecked column", () => {
    renderHeader([{ id: "cc2", checkedAt: null, provider: "piltover" }]);

    expect(screen.getByText("Unchecked")).toBeInTheDocument();
    expect(screen.queryByText("Trusted")).not.toBeInTheDocument();
  });

  it("badges a checked trusted column", () => {
    renderHeader(
      [{ id: "cc2", checkedAt: "2026-09-10T00:00:00Z", provider: "piltover" }],
      {},
      new Set(["piltover"]),
    );

    expect(screen.getByText("Checked")).toBeInTheDocument();
    expect(screen.getByText("Trusted")).toBeInTheDocument();
  });

  it("titles a scraped source by its provider", () => {
    renderHeader([{ id: "cc2", checkedAt: null, provider: "piltover" }]);

    expect(screen.getByText("piltover")).toBeInTheDocument();
  });
});
