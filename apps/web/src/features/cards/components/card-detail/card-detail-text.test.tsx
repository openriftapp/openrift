import type { CardErrata } from "@openrift/shared/types/catalog";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { makeCardErrata, stubPrinting } from "@/test/factories";

vi.mock("@/hooks/use-domain-colors", () => ({ useDomainColors: () => ({}) }));
vi.mock("@/features/cards/components/rarity-icon", () => ({ RarityIcon: () => null }));
vi.mock("./errata-notice", () => ({
  ErrataScope: ({ errata, children }: { errata: CardErrata | null; children: ReactNode }) => (
    <div data-errata-language={errata?.language ?? "none"}>{children}</div>
  ),
  ErrataCardText: ({ corrected }: { corrected: string }) => <span>{corrected}</span>,
}));

// oxlint-disable-next-line import/first -- must import after vi.mock
const { CardDetailText } = await import("./card-detail-text");

const englishErrata = makeCardErrata({ language: "EN", correctedRulesText: "Deal 3 to a unit." });

function renderText(language: string, printedRulesText: string, errata: CardErrata[]) {
  const printing = stubPrinting({ language, printedRulesText, card: { errata } });
  return render(<CardDetailText printing={printing} />);
}

describe("CardDetailText errata language", () => {
  it("shows the English errata on an English printing", () => {
    const { container } = renderText("EN", "Deal 2 to a unit.", [englishErrata]);
    expect(screen.getByText("Deal 3 to a unit.")).toBeInTheDocument();
    expect(container.querySelector("[data-errata-language]")).toHaveAttribute(
      "data-errata-language",
      "EN",
    );
  });

  it("shows the printed text on a French printing with only English errata", () => {
    const { container } = renderText("FR", "Infligez 2 dégâts à une unité.", [englishErrata]);
    expect(screen.getByText("Infligez 2 dégâts à une unité.")).toBeInTheDocument();
    expect(screen.queryByText("Deal 3 to a unit.")).not.toBeInTheDocument();
    expect(container.querySelector("[data-errata-language]")).toHaveAttribute(
      "data-errata-language",
      "none",
    );
  });

  it("shows the French errata on a French printing", () => {
    const frenchErrata = makeCardErrata({
      language: "FR",
      correctedRulesText: "Infligez 3 dégâts à une unité.",
    });
    renderText("FR", "Infligez 2 dégâts à une unité.", [englishErrata, frenchErrata]);
    expect(screen.getByText("Infligez 3 dégâts à une unité.")).toBeInTheDocument();
  });
});
