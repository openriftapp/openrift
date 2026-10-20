import type { Printing } from "@openrift/shared/types/catalog";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { stubPrinting } from "@/test/factories";

const printings: Printing[] = [
  stubPrinting({
    printingId: "p-1",
    faceId: "face-bird",
    shortCode: "SGN-T01",
    publicCode: "SGN-T01",
    card: { name: "Bird" },
  }),
  stubPrinting({
    printingId: "p-2",
    faceId: "face-bird",
    shortCode: "SGN-T01",
    publicCode: "SGN-T01",
    card: { name: "Bird" },
  }),
  stubPrinting({
    printingId: "p-3",
    faceId: "face-gold",
    shortCode: "SGN-T05",
    publicCode: "SGN-T05",
    card: { name: "Gold" },
  }),
];

vi.mock("@/features/cards/hooks/use-cards", () => ({
  useCards: () => ({ allPrintings: printings }),
}));

const { SideSearch } = await import("./side-search");

describe("SideSearch", () => {
  it("offers a side shown by several printings once", async () => {
    render(<SideSearch onPick={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Code of the other face"), "SGN-T0");
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("leaves out excluded sides", async () => {
    render(<SideSearch excludeFaceIds={["face-bird"]} onPick={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Code of the other face"), "SGN-T0");
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Gold/u })).toBeInTheDocument();
  });

  it("hands the picked side back and clears the query", async () => {
    const onPick = vi.fn();
    render(<SideSearch onPick={onPick} />);
    const input = screen.getByLabelText("Code of the other face");
    await userEvent.type(input, "T05");
    await userEvent.click(screen.getByRole("button", { name: /Gold/u }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ faceId: "face-gold" }));
    expect(input).toHaveValue("");
  });
});
