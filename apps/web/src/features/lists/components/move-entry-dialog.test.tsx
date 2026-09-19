import type { Printing } from "@openrift/shared/types/catalog";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { stubCopy, stubPrinting } from "@/test/factories";

vi.mock("@/features/cards/components/printing-label", () => ({
  ImportPrintingLabel: ({ printing }: { printing: Printing }) => <span>{printing.id}</span>,
}));

// oxlint-disable-next-line import/first -- must import after vi.mock
const { MoveEntryDialogBody } = await import("./move-entry-dialog");

const printingA = stubPrinting({ id: "p-a" });
const printingB = stubPrinting({ id: "p-b" });

function renderBody(props: Partial<Parameters<typeof MoveEntryDialogBody>[0]> = {}) {
  const onConfirm = vi.fn();
  render(
    <Dialog open onOpenChange={() => {}}>
      <DialogContent>
        <MoveEntryDialogBody
          mode="move"
          cardName="Chaos Rune"
          subjectCount={1}
          sourceIntent="wish"
          target={{ name: "Trades", intent: "trade" }}
          pick="none"
          currentPrintingId="p-a"
          printings={[printingA, printingB]}
          copies={[]}
          quantity={1}
          onConfirm={onConfirm}
          onCancel={() => {}}
          isPending={false}
          {...props}
        />
      </DialogContent>
    </Dialog>,
  );
  return { onConfirm };
}

describe("MoveEntryDialogBody", () => {
  it("confirms an intent change with no resolution", () => {
    const { onConfirm } = renderBody();
    expect(screen.getByText(/leaves your wishlist and joins your tradelist/u)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Move" }));
    expect(onConfirm).toHaveBeenCalledWith(null);
  });

  it("preselects the current printing and confirms the picked one", () => {
    const { onConfirm } = renderBody({ pick: "printing", sourceIntent: "trade" });
    fireEvent.click(screen.getByText("p-b"));
    fireEvent.click(screen.getByRole("button", { name: "Move" }));
    expect(onConfirm).toHaveBeenCalledWith({ printingId: "p-b" });
  });

  it("preselects the entry's quantity worth of copies and toggles on click", () => {
    const copies = ["c1", "c2", "c3"].map((id) => ({
      copy: stubCopy({ id, printingId: "p-a" }),
      printing: printingA,
      collectionName: "Binder",
    }));
    const { onConfirm } = renderBody({ pick: "copies", copies, quantity: 2 });
    const rows = document.querySelectorAll<HTMLElement>('[data-slot="picker-row"]');
    fireEvent.click(rows[2]!);
    fireEvent.click(rows[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Move" }));
    expect(onConfirm).toHaveBeenCalledWith({ copyIds: ["c2", "c3"] });
  });

  it("blocks confirmation when the user owns no copies", () => {
    const { onConfirm } = renderBody({ pick: "copies", copies: [] });
    expect(screen.getByText(/don't own any copies of Chaos Rune/u)).toBeTruthy();
    const button = screen.getByRole("button", { name: "Move" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
