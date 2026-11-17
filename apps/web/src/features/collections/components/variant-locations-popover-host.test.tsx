import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLayoutEffect, useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";
import { useAddModeStore } from "@/features/collections/stores/add-mode-store";
import { stubPrinting } from "@/test/factories";
import { createStoreResetter } from "@/test/store-helpers";

vi.mock("@/features/collections/hooks/use-copies", () => ({
  useBatchedAddCopies: () => ({ add: vi.fn() }),
  useDisposeCopies: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/features/collections/hooks/use-copies-collection", () => ({
  useCopiesCollection: () => ({ toArray: [] }),
}));

// Stands in for PickerList, which takes focus on mount before the popover records
// what was focused, so the trigger is not the element focus returns to.
function FocusingContent() {
  const ref = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return <Button ref={ref}>Add to Binder</Button>;
}

vi.mock("@/features/collections/components/variant-locations-popover", () => ({
  VariantLocationsPopover: FocusingContent,
}));

const { useQuickAddActions } = await import("@/features/collections/hooks/use-quick-add-actions");
const { VariantLocationsPopoverHost } = await import("./variant-locations-popover-host");

const printing = stubPrinting({ printingId: "p1", cardId: "c1", card: { name: "Alpha" } });
const printingsByCardId = new Map([["c1", [printing]]]);

function Harness() {
  const { handleOpenVariants, closeVariants } = useQuickAddActions("inbox", "inbox");
  return (
    <>
      <Button onClick={(event) => handleOpenVariants?.(printing, event.currentTarget, "add")}>
        Variants and collections
      </Button>
      <Button>Elsewhere</Button>
      <VariantLocationsPopoverHost
        catalogPrintingsByCardId={printingsByCardId}
        languageScopedPrintingsByCardId={printingsByCardId}
        onQuickAdd={vi.fn()}
        onAddToCollection={vi.fn()}
        onRemoveFromCollection={vi.fn()}
        closeVariants={closeVariants}
      />
    </>
  );
}

afterEach(createStoreResetter(useAddModeStore));

describe("VariantLocationsPopoverHost", () => {
  it("stays closed when its own trigger is pressed again", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Variants and collections" });

    await user.click(trigger);
    await screen.findByRole("button", { name: "Add to Binder" });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Add to Binder" })).toBeNull();
    });
    expect(useAddModeStore.getState().variantPopover).toBeNull();
  });

  it("closes when focus moves to another control", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Variants and collections" }));
    await screen.findByRole("button", { name: "Add to Binder" });
    await user.click(screen.getByRole("button", { name: "Elsewhere" }));

    await waitFor(() => {
      expect(useAddModeStore.getState().variantPopover).toBeNull();
    });
  });
});
